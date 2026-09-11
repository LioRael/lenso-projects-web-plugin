use std::{any::Any, cell::Cell, collections::BTreeMap, rc::Rc, time::Duration as StdDuration};

use futures::future::LocalBoxFuture;
use lenso_app_plan::{
    AppComposition, CapabilityBinding, CapabilityEndpointPlan, CapabilityRequirementPlan,
    PluginInstancePlan, ResolvedAppPlan,
};
use lenso_auth_sdk::{
    ActorAssertion, ActorAssertionIssuer, ActorProjectionError, FixedClock, TypedActor, Validity,
    audience, authenticated_response,
};
use lenso_capability_auth as auth;
use lenso_capability_auth::{Auth, AuthEndpoint, AuthProvider};
use lenso_capability_http_endpoint as endpoint;
use lenso_capability_http_endpoint::{
    HandleRequest, HandleRequestCredential, HandleRequestHeadersItem,
};
use lenso_capability_organization_directory as directory;
use lenso_capability_projects as projects;
use lenso_capability_projects_admin as admin;
use lenso_capability_projects_collaboration as collaboration;
use lenso_kernel::{
    InvocationContext, Kernel, NativeRequestEndpoint, NativeRequestFuture, RuntimeFailure,
    ShutdownOutcome,
};
use lenso_native_adapter::{
    NativePluginFactory, NativePluginFactoryContext, NativePluginInstance, NativePluginRegistry,
};
use lenso_projects_web_plugin::PACKAGE_ID;
use lenso_runner::TokioDriver;
use time::{Duration, OffsetDateTime};

const CALLER_PACKAGE: &str = "test.projects-web-caller";
const AUTH_PACKAGE: &str = "test.projects-web-auth";
const DOMAIN_PACKAGE: &str = "test.projects-web-domain";

const PROJECT_OPERATIONS: &[&str] = &[
    projects::ARCHIVE_ISSUE_OPERATION,
    projects::ARCHIVE_PROJECT_OPERATION,
    projects::CREATE_ISSUE_OPERATION,
    projects::CREATE_PROJECT_OPERATION,
    projects::GET_ISSUE_OPERATION,
    projects::GET_PROJECT_OPERATION,
    projects::LIST_ACTIVITY_OPERATION,
    projects::LIST_ISSUES_OPERATION,
    projects::LIST_PROJECTS_OPERATION,
    projects::MOVE_ISSUE_OPERATION,
    projects::PUT_EXTERNAL_LINK_OPERATION,
    projects::UPDATE_ISSUE_OPERATION,
    projects::UPDATE_PROJECT_OPERATION,
];

const COLLABORATION_OPERATIONS: &[&str] = &[
    collaboration::ADD_COMMENT_OPERATION,
    collaboration::ADD_ISSUE_RELATION_OPERATION,
    collaboration::CREATE_PROJECT_UPDATE_OPERATION,
    collaboration::DELETE_COMMENT_OPERATION,
    collaboration::LIST_COMMENTS_OPERATION,
    collaboration::LIST_PROJECT_UPDATES_OPERATION,
    collaboration::REMOVE_ISSUE_RELATION_OPERATION,
    collaboration::UPDATE_COMMENT_OPERATION,
];

const ADMIN_OPERATIONS: &[&str] = &[
    admin::ARCHIVE_PROJECT_STATUS_OPERATION,
    admin::ARCHIVE_WORKFLOW_STATE_OPERATION,
    admin::DELETE_PROJECT_STATUS_OPERATION,
    admin::DELETE_WORKFLOW_STATE_OPERATION,
    admin::GET_PROJECT_STATUS_OPERATION,
    admin::GET_WORKFLOW_STATE_OPERATION,
    admin::LIST_CYCLES_OPERATION,
    admin::LIST_LABELS_OPERATION,
    admin::LIST_MILESTONES_OPERATION,
    admin::LIST_PROJECT_STATUSES_OPERATION,
    admin::LIST_TEAMS_OPERATION,
    admin::LIST_WORKFLOW_STATES_OPERATION,
    admin::PUT_CYCLE_OPERATION,
    admin::PUT_LABEL_OPERATION,
    admin::PUT_MILESTONE_OPERATION,
    admin::PUT_PROJECT_STATUS_OPERATION,
    admin::PUT_TEAM_OPERATION,
    admin::PUT_WORKFLOW_STATE_OPERATION,
    admin::REORDER_PROJECT_STATUSES_OPERATION,
    admin::REORDER_WORKFLOW_STATES_OPERATION,
    admin::SET_TEAM_MEMBER_OPERATION,
];

#[derive(Clone, Copy, Debug)]
enum ProjectsMode {
    Success,
    PrivateTeam,
    Runtime,
}

#[tokio::test(flavor = "current_thread")]
async fn authenticates_forwards_actor_and_preserves_domain_and_runtime_boundaries() {
    tokio::task::LocalSet::new()
        .run_until(async {
            lenso_projects_web_plugin::link();
            let now = OffsetDateTime::from_unix_timestamp(1_800_000_000).unwrap();
            let issuer = ActorAssertionIssuer::new("test.auth", b"projects-web-test-key");

            for (mode, expected_status) in [
                (ProjectsMode::Success, Some(200)),
                (ProjectsMode::PrivateTeam, Some(404)),
                (ProjectsMode::Runtime, None),
            ] {
                let observed_actor = Rc::new(Cell::new(false));
                let app = Kernel::start_native(
                    web_plan(),
                    TokioDriver::new(),
                    NativePluginRegistry::new()
                        .with_linked_factories()
                        .with_factory(EmptyFactory)
                        .with_factory(TestAuthFactory {
                            issuer: issuer.clone(),
                            now,
                        })
                        .with_factory(DomainFactory {
                            verifier: issuer.verifier(),
                            now,
                            observed_actor: Rc::clone(&observed_actor),
                            mode,
                            require_actor: true,
                        }),
                )
                .await
                .unwrap();

                if matches!(mode, ProjectsMode::Success) {
                    let unauthenticated = app
                        .invoke::<endpoint::EndpointHandle>(
                            "caller",
                            endpoint::HANDLE_OPERATION,
                            list_request("bad"),
                        )
                        .await
                        .unwrap()
                        .unwrap();
                    assert_eq!(unauthenticated.status, 401);

                    let wrong_actor = app
                        .invoke::<endpoint::EndpointHandle>(
                            "caller",
                            endpoint::HANDLE_OPERATION,
                            list_request("wrong-kind"),
                        )
                        .await
                        .unwrap()
                        .unwrap();
                    assert_eq!(wrong_actor.status, 403);
                }

                let result = app
                    .invoke::<endpoint::EndpointHandle>(
                        "caller",
                        endpoint::HANDLE_OPERATION,
                        list_request("good"),
                    )
                    .await;
                match expected_status {
                    Some(status) => {
                        let response = result.unwrap().unwrap();
                        assert_eq!(response.status, status);
                        assert!(observed_actor.get());
                    }
                    None => assert!(matches!(
                        result,
                        Err(RuntimeFailure::Unavailable {
                            capability: projects::CAPABILITY_ID
                        })
                    )),
                }

                assert_eq!(
                    app.shutdown(StdDuration::from_secs(1)).await,
                    ShutdownOutcome::Clean
                );
            }
        })
        .await;
}

#[tokio::test(flavor = "current_thread")]
async fn removing_web_instance_does_not_remove_projects_provider() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let now = OffsetDateTime::from_unix_timestamp(1_800_000_000).unwrap();
            let issuer = ActorAssertionIssuer::new("test.auth", b"projects-web-test-key");
            let app = Kernel::start_native(
                domain_only_plan(),
                TokioDriver::new(),
                NativePluginRegistry::new()
                    .with_factory(EmptyFactory)
                    .with_factory(DomainFactory {
                        verifier: issuer.verifier(),
                        now,
                        observed_actor: Rc::new(Cell::new(false)),
                        mode: ProjectsMode::Success,
                        require_actor: false,
                    }),
            )
            .await
            .unwrap();

            let result = app
                .invoke::<projects::ProjectsListProjects>(
                    "caller",
                    projects::LIST_PROJECTS_OPERATION,
                    projects::ListProjectsRequest {
                        after: None,
                        include_archived: false,
                        limit: 10,
                        organization_id: "org_1".to_owned(),
                        team_id: None,
                    },
                )
                .await
                .unwrap()
                .unwrap();
            assert!(result.items.is_empty());
            assert_eq!(
                app.shutdown(StdDuration::from_secs(1)).await,
                ShutdownOutcome::Clean
            );
        })
        .await;
}

#[derive(Clone, Copy, Debug)]
struct EmptyFactory;

impl NativePluginFactory for EmptyFactory {
    fn package_id(&self) -> &'static str {
        CALLER_PACKAGE
    }

    fn instantiate(
        &self,
        _: NativePluginFactoryContext<'_>,
    ) -> Result<NativePluginInstance, RuntimeFailure> {
        Ok(NativePluginInstance::default())
    }
}

#[derive(Clone, Debug)]
struct TestAuthFactory {
    issuer: ActorAssertionIssuer,
    now: OffsetDateTime,
}

impl NativePluginFactory for TestAuthFactory {
    fn package_id(&self) -> &'static str {
        AUTH_PACKAGE
    }

    fn instantiate(
        &self,
        _: NativePluginFactoryContext<'_>,
    ) -> Result<NativePluginInstance, RuntimeFailure> {
        Ok(NativePluginInstance::new(vec![Rc::new(AuthEndpoint::new(
            TestAuth {
                issuer: self.issuer.clone(),
                now: self.now,
            },
        ))]))
    }
}

#[derive(Clone, Debug)]
struct TestAuth {
    issuer: ActorAssertionIssuer,
    now: OffsetDateTime,
}

impl AuthProvider for TestAuth {
    fn authenticate(
        &self,
        _context: InvocationContext,
        request: auth::AuthenticateRequest,
    ) -> NativeRequestFuture<Auth> {
        let result = match request.credential {
            Some(credential)
                if credential.scheme == "bearer"
                    && matches!(credential.value.as_str(), "good" | "wrong-kind") =>
            {
                let actor_kind = if credential.value == "good" {
                    "user"
                } else {
                    "service"
                };
                let assertion = self.issuer.issue(
                    "user_1",
                    actor_kind,
                    "test",
                    [audience(
                        projects::CAPABILITY_ID,
                        projects::LIST_PROJECTS_OPERATION,
                    )],
                    Validity::new(
                        self.now - Duration::seconds(1),
                        self.now + Duration::minutes(1),
                    )
                    .unwrap(),
                    BTreeMap::new(),
                );
                Ok(Ok(authenticated_response(&assertion)))
            }
            _ => Ok(Err(auth::AuthenticateError::Invalid)),
        };
        Box::pin(std::future::ready(result))
    }
}

#[derive(Clone, Debug)]
struct DomainFactory {
    verifier: lenso_auth_sdk::ActorAssertionVerifier,
    now: OffsetDateTime,
    observed_actor: Rc<Cell<bool>>,
    mode: ProjectsMode,
    require_actor: bool,
}

impl NativePluginFactory for DomainFactory {
    fn package_id(&self) -> &'static str {
        DOMAIN_PACKAGE
    }

    fn instantiate(
        &self,
        _: NativePluginFactoryContext<'_>,
    ) -> Result<NativePluginInstance, RuntimeFailure> {
        Ok(NativePluginInstance::new(vec![
            Rc::new(FakeProjectsEndpoint {
                verifier: self.verifier.clone(),
                now: self.now,
                observed_actor: Rc::clone(&self.observed_actor),
                mode: self.mode,
                require_actor: self.require_actor,
            }) as Rc<dyn NativeRequestEndpoint>,
            Rc::new(PassiveEndpoint {
                capability: collaboration::CAPABILITY_ID,
                descriptor: collaboration::DESCRIPTOR_VERSION,
                operations: COLLABORATION_OPERATIONS,
            }) as Rc<dyn NativeRequestEndpoint>,
            Rc::new(PassiveEndpoint {
                capability: directory::CAPABILITY_ID,
                descriptor: directory::DESCRIPTOR_VERSION,
                operations: &[
                    directory::GET_ORGANIZATION_OPERATION,
                    directory::LIST_FOR_SUBJECT_OPERATION,
                ],
            }) as Rc<dyn NativeRequestEndpoint>,
            Rc::new(PassiveEndpoint {
                capability: admin::CAPABILITY_ID,
                descriptor: admin::DESCRIPTOR_VERSION,
                operations: ADMIN_OPERATIONS,
            }) as Rc<dyn NativeRequestEndpoint>,
        ]))
    }
}

#[derive(Debug)]
struct FakeProjectsEndpoint {
    verifier: lenso_auth_sdk::ActorAssertionVerifier,
    now: OffsetDateTime,
    observed_actor: Rc<Cell<bool>>,
    mode: ProjectsMode,
    require_actor: bool,
}

impl NativeRequestEndpoint for FakeProjectsEndpoint {
    fn capability_id(&self) -> &'static str {
        projects::CAPABILITY_ID
    }

    fn descriptor_version(&self) -> &'static str {
        projects::DESCRIPTOR_VERSION
    }

    fn operations(&self) -> &'static [&'static str] {
        PROJECT_OPERATIONS
    }

    fn invoke(
        &self,
        operation: &str,
        request: Box<dyn Any>,
        context: InvocationContext,
    ) -> LocalBoxFuture<'static, Result<Result<Box<dyn Any>, Box<dyn Any>>, RuntimeFailure>> {
        if operation != projects::LIST_PROJECTS_OPERATION {
            return Box::pin(std::future::ready(Err(RuntimeFailure::UnknownOperation {
                capability: projects::CAPABILITY_ID,
                operation: operation.to_owned(),
            })));
        }
        if request.downcast::<projects::ListProjectsRequest>().is_err() {
            return Box::pin(std::future::ready(Err(RuntimeFailure::ProtocolViolation {
                capability: projects::CAPABILITY_ID,
            })));
        }
        if self.require_actor {
            if self
                .verifier
                .project_context::<ProjectsActor>(
                    &context,
                    projects::CAPABILITY_ID,
                    projects::LIST_PROJECTS_OPERATION,
                    &FixedClock::new(self.now),
                )
                .is_err()
            {
                return Box::pin(std::future::ready(Ok(Err(Box::new(
                    projects::ListProjectsError::Unauthenticated,
                )
                    as Box<dyn Any>))));
            }
            self.observed_actor.set(true);
        }
        let result = match self.mode {
            ProjectsMode::Success => Ok(Ok(Box::new(projects::ListProjectsResponse {
                items: Vec::new(),
                next_cursor: None,
            }) as Box<dyn Any>)),
            ProjectsMode::PrivateTeam => Ok(Err(
                Box::new(projects::ListProjectsError::PrivateTeam) as Box<dyn Any>,
            )),
            ProjectsMode::Runtime => Err(RuntimeFailure::Unavailable {
                capability: projects::CAPABILITY_ID,
            }),
        };
        Box::pin(std::future::ready(result))
    }
}

#[derive(Debug)]
struct ProjectsActor;

impl TypedActor for ProjectsActor {
    fn from_assertion(assertion: &ActorAssertion) -> Result<Self, ActorProjectionError> {
        if assertion.actor_kind() != "user" || assertion.subject() != "user_1" {
            return Err(ActorProjectionError::UnexpectedActorKind {
                expected: "user".to_owned(),
                actual: assertion.actor_kind().to_owned(),
            });
        }
        Ok(Self)
    }
}

#[derive(Debug)]
struct PassiveEndpoint {
    capability: &'static str,
    descriptor: &'static str,
    operations: &'static [&'static str],
}

impl NativeRequestEndpoint for PassiveEndpoint {
    fn capability_id(&self) -> &'static str {
        self.capability
    }

    fn descriptor_version(&self) -> &'static str {
        self.descriptor
    }

    fn operations(&self) -> &'static [&'static str] {
        self.operations
    }

    fn invoke(
        &self,
        operation: &str,
        _request: Box<dyn Any>,
        _context: InvocationContext,
    ) -> LocalBoxFuture<'static, Result<Result<Box<dyn Any>, Box<dyn Any>>, RuntimeFailure>> {
        Box::pin(std::future::ready(Err(RuntimeFailure::UnknownOperation {
            capability: self.capability,
            operation: operation.to_owned(),
        })))
    }
}

fn web_plan() -> ResolvedAppPlan {
    web_plan_with_config("{}")
}

fn web_plan_with_config(config: &str) -> ResolvedAppPlan {
    let caller = PluginInstancePlan::new("caller", CALLER_PACKAGE).with_requirement(
        CapabilityRequirementPlan::one(endpoint::CAPABILITY_ID, endpoint::DESCRIPTOR_VERSION),
    );
    let web = PluginInstancePlan::new("projects-web", PACKAGE_ID)
        .with_configuration(config)
        .with_requirement(CapabilityRequirementPlan::one(
            directory::CAPABILITY_ID,
            directory::DESCRIPTOR_VERSION,
        ))
        .with_capability(CapabilityEndpointPlan::new(
            endpoint::CAPABILITY_ID,
            endpoint::DESCRIPTOR_VERSION,
            [endpoint::DESCRIBE_OPERATION, endpoint::HANDLE_OPERATION],
        ))
        .with_requirement(CapabilityRequirementPlan::one(
            auth::CAPABILITY_ID,
            auth::DESCRIPTOR_VERSION,
        ))
        .with_requirement(CapabilityRequirementPlan::one(
            projects::CAPABILITY_ID,
            projects::DESCRIPTOR_VERSION,
        ))
        .with_requirement(CapabilityRequirementPlan::one(
            collaboration::CAPABILITY_ID,
            collaboration::DESCRIPTOR_VERSION,
        ))
        .with_requirement(CapabilityRequirementPlan::one(
            admin::CAPABILITY_ID,
            admin::DESCRIPTOR_VERSION,
        ));
    let auth_provider =
        PluginInstancePlan::new("auth", AUTH_PACKAGE).with_capability(CapabilityEndpointPlan::new(
            auth::CAPABILITY_ID,
            auth::DESCRIPTOR_VERSION,
            [auth::AUTHENTICATE_OPERATION],
        ));
    let domain = domain_instance();
    AppComposition::new(
        vec![caller, web, auth_provider, domain],
        vec![
            CapabilityBinding::new(
                "projects-web",
                directory::CAPABILITY_ID,
                directory::DESCRIPTOR_VERSION,
                "domain",
            ),
            CapabilityBinding::new(
                "caller",
                endpoint::CAPABILITY_ID,
                endpoint::DESCRIPTOR_VERSION,
                "projects-web",
            ),
            CapabilityBinding::new(
                "projects-web",
                auth::CAPABILITY_ID,
                auth::DESCRIPTOR_VERSION,
                "auth",
            ),
            CapabilityBinding::new(
                "projects-web",
                projects::CAPABILITY_ID,
                projects::DESCRIPTOR_VERSION,
                "domain",
            ),
            CapabilityBinding::new(
                "projects-web",
                collaboration::CAPABILITY_ID,
                collaboration::DESCRIPTOR_VERSION,
                "domain",
            ),
            CapabilityBinding::new(
                "projects-web",
                admin::CAPABILITY_ID,
                admin::DESCRIPTOR_VERSION,
                "domain",
            ),
        ],
    )
    .resolve()
    .unwrap()
}

fn domain_only_plan() -> ResolvedAppPlan {
    let caller = PluginInstancePlan::new("caller", CALLER_PACKAGE).with_requirement(
        CapabilityRequirementPlan::one(projects::CAPABILITY_ID, projects::DESCRIPTOR_VERSION),
    );
    AppComposition::new(
        vec![caller, domain_instance()],
        vec![CapabilityBinding::new(
            "caller",
            projects::CAPABILITY_ID,
            projects::DESCRIPTOR_VERSION,
            "domain",
        )],
    )
    .resolve()
    .unwrap()
}

fn domain_instance() -> PluginInstancePlan {
    PluginInstancePlan::new("domain", DOMAIN_PACKAGE)
        .with_capability(CapabilityEndpointPlan::new(
            directory::CAPABILITY_ID,
            directory::DESCRIPTOR_VERSION,
            [
                directory::GET_ORGANIZATION_OPERATION,
                directory::LIST_FOR_SUBJECT_OPERATION,
            ],
        ))
        .with_capability(CapabilityEndpointPlan::new(
            projects::CAPABILITY_ID,
            projects::DESCRIPTOR_VERSION,
            PROJECT_OPERATIONS.iter().copied(),
        ))
        .with_capability(CapabilityEndpointPlan::new(
            collaboration::CAPABILITY_ID,
            collaboration::DESCRIPTOR_VERSION,
            COLLABORATION_OPERATIONS.iter().copied(),
        ))
        .with_capability(CapabilityEndpointPlan::new(
            admin::CAPABILITY_ID,
            admin::DESCRIPTOR_VERSION,
            ADMIN_OPERATIONS.iter().copied(),
        ))
}

fn list_request(token: &str) -> HandleRequest {
    HandleRequest {
        body: Vec::new().into(),
        credential: Some(HandleRequestCredential {
            scheme: "bearer".to_owned(),
            value: token.to_owned(),
        }),
        headers: vec![HandleRequestHeadersItem {
            name: "accept".to_owned(),
            value: "application/json".to_owned(),
        }],
        method: "GET".to_owned(),
        path: "/api/projects".to_owned(),
        path_parameters: Vec::new(),
        query: Some("organization_id=org_1&include_archived=false&limit=10".to_owned()),
        request_id: "request-1".to_owned(),
        route_id: "projects.web.projects.list".to_owned(),
    }
}

#[tokio::test(flavor = "current_thread")]
async fn native_context_requires_valid_signature_audience_and_lifetime() {
    tokio::task::LocalSet::new().run_until(async {
        lenso_projects_web_plugin::link();
        let now = OffsetDateTime::now_utc();
        let issuer = ActorAssertionIssuer::new("test.auth", b"projects-web-test-key");
        let other = ActorAssertionIssuer::new("test.auth", b"different-signing-authority");
        let observed = Rc::new(Cell::new(false));
        let config = serde_json::json!({"invocation_auth_issuer":"test.auth","invocation_auth_public_key":issuer.public_key_base64()}).to_string();
        let app = Kernel::start_native(web_plan_with_config(&config), TokioDriver::new(), NativePluginRegistry::new().with_linked_factories().with_factory(EmptyFactory).with_factory(TestAuthFactory {issuer:issuer.clone(),now}).with_factory(DomainFactory {verifier:issuer.verifier(),now,observed_actor:observed.clone(),mode:ProjectsMode::Success,require_actor:true})).await.unwrap();
        for (signer, include_audience, expired, status) in [(&issuer,true,false,200),(&other,true,false,401),(&issuer,false,false,401),(&issuer,true,true,401)] {
            observed.set(false);
            let mut audiences = vec![audience(projects::CAPABILITY_ID, projects::LIST_PROJECTS_OPERATION)];
            if include_audience { audiences.push(audience(endpoint::CAPABILITY_ID, endpoint::HANDLE_OPERATION)); }
            let expiry = if expired {now - Duration::seconds(1)} else {now + Duration::minutes(1)};
            let assertion = signer.issue("user_1", "user", "password", audiences, Validity::new(now-Duration::minutes(1), expiry).unwrap(), BTreeMap::new());
            let context = assertion.attach(InvocationContext::new(1, None, lenso_kernel::CancellationToken::new())).unwrap();
            let mut request = list_request("unused"); request.credential = None;
            let response = app.handle::<endpoint::EndpointHandle>("caller").unwrap().invoke_with_context(endpoint::HANDLE_OPERATION, context, request).await.unwrap().unwrap();
            assert_eq!(response.status, status);
            assert_eq!(observed.get(), status == 200);
        }
        let mut request = list_request("unused"); request.credential = None;
        assert_eq!(app.invoke::<endpoint::EndpointHandle>("caller",endpoint::HANDLE_OPERATION,request).await.unwrap().unwrap().status,401);
        assert_eq!(app.shutdown(StdDuration::from_secs(1)).await, ShutdownOutcome::Clean);
    }).await;
}

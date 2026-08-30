//! Standalone linked Web surface for the Lenso Projects capabilities.

mod assets;

use std::fmt::Debug;

use lenso::prelude::*;
use lenso_auth_sdk::{AuthOutcome, CredentialEvidence, authenticate_request, decode_auth_response};
use lenso_capability_auth as auth;
use lenso_capability_http_endpoint::{
    self as http_endpoint_contract, EndpointHandleInvocationError, ExtractorFuture,
    ExtractorRejection, FromRequest, HandleRequest, HandleResponse, HandleResponseHeadersItem,
    Json, Path, QueryParams, endpoint,
    response::{self, HeaderValue, StatusCode, header},
};
use lenso_capability_projects as projects;
use lenso_capability_projects_admin as admin;
use lenso_capability_projects_collaboration as collaboration;
use lenso_kernel::{InvocationContext, RuntimeFailure};
use serde::{Deserialize, Serialize};

/// Forces this native Plugin crate to be retained by a linked Host.
pub const fn link() {}

#[lenso::plugin]
#[derive(Clone, Debug, Default)]
pub struct ProjectsWebPlugin {
    auth: Port<auth::AuthClient>,
    projects: Port<projects::ProjectsClient>,
    collaboration: Port<collaboration::ProjectsCollaborationClient>,
    admin: Port<admin::ProjectsAdminClient>,
}

#[endpoint]
impl ProjectsWebPlugin {
    #[get("projects.web.page", "/projects")]
    async fn page(&self) -> Result<HandleResponse, EndpointHandleInvocationError> {
        std::future::ready(()).await;
        Ok(asset(
            StatusCode::OK,
            "text/html; charset=utf-8",
            assets::PAGE,
        ))
    }

    #[get("projects.web.css", "/projects/assets/app.css")]
    async fn css(&self) -> Result<HandleResponse, EndpointHandleInvocationError> {
        std::future::ready(()).await;
        Ok(asset(
            StatusCode::OK,
            "text/css; charset=utf-8",
            assets::CSS,
        ))
    }

    #[get("projects.web.js", "/projects/assets/app.js")]
    async fn javascript(&self) -> Result<HandleResponse, EndpointHandleInvocationError> {
        std::future::ready(()).await;
        Ok(asset(
            StatusCode::OK,
            "text/javascript; charset=utf-8",
            assets::JS,
        ))
    }

    #[get("projects.web.projects.list", "/api/projects")]
    async fn list_projects(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        QueryParams(query): QueryParams<ListProjectsQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.projects
                .list_projects_with_context(context, query.into_request())
                .await,
            StatusCode::OK,
        )
    }

    #[post("projects.web.projects.create", "/api/projects")]
    async fn create_project(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Json(request): Json<projects::CreateProjectRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.projects
                .create_project_with_context(context, request)
                .await,
            StatusCode::CREATED,
        )
    }

    #[get("projects.web.projects.detail", "/api/projects/{project_id}")]
    async fn get_project(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<ProjectPath>,
        QueryParams(query): QueryParams<OrganizationQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.projects
                .get_project_with_context(
                    context,
                    projects::GetProjectRequest {
                        organization_id: query.organization_id,
                        project_id: path.project_id,
                    },
                )
                .await,
            StatusCode::OK,
        )
    }

    #[patch("projects.web.projects.update", "/api/projects/{project_id}")]
    async fn update_project(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<ProjectPath>,
        Json(request): Json<projects::UpdateProjectRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.project_id != request.project_id {
            return Ok(path_mismatch("project_id"));
        }
        json_result(
            self.projects
                .update_project_with_context(context, request)
                .await,
            StatusCode::OK,
        )
    }

    #[post("projects.web.projects.archive", "/api/projects/{project_id}/archive")]
    async fn archive_project(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<ProjectPath>,
        Json(request): Json<projects::ArchiveProjectRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.project_id != request.project_id {
            return Ok(path_mismatch("project_id"));
        }
        json_result(
            self.projects
                .archive_project_with_context(context, request)
                .await,
            StatusCode::OK,
        )
    }

    #[get("projects.web.issues.list", "/api/projects/{project_id}/issues")]
    async fn list_issues(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<ProjectPath>,
        QueryParams(query): QueryParams<ListIssuesQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.projects
                .list_issues_with_context(context, query.into_request(path.project_id))
                .await,
            StatusCode::OK,
        )
    }

    #[post("projects.web.issues.create", "/api/projects/{project_id}/issues")]
    async fn create_issue(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<ProjectPath>,
        Json(request): Json<projects::CreateIssueRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.project_id != request.project_id {
            return Ok(path_mismatch("project_id"));
        }
        json_result(
            self.projects
                .create_issue_with_context(context, request)
                .await,
            StatusCode::CREATED,
        )
    }

    #[get("projects.web.issues.detail", "/api/issues/{issue_ref}")]
    async fn get_issue(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<IssueRefPath>,
        QueryParams(query): QueryParams<OrganizationQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.projects
                .get_issue_with_context(
                    context,
                    projects::GetIssueRequest {
                        issue_ref: path.issue_ref,
                        organization_id: query.organization_id,
                    },
                )
                .await,
            StatusCode::OK,
        )
    }

    #[patch("projects.web.issues.update", "/api/issues/{issue_id}")]
    async fn update_issue(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<IssuePath>,
        Json(request): Json<projects::UpdateIssueRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.issue_id != request.issue_id {
            return Ok(path_mismatch("issue_id"));
        }
        json_result(
            self.projects
                .update_issue_with_context(context, request)
                .await,
            StatusCode::OK,
        )
    }

    #[post("projects.web.issues.move", "/api/issues/{issue_id}/move")]
    async fn move_issue(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<IssuePath>,
        Json(request): Json<projects::MoveIssueRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.issue_id != request.issue_id {
            return Ok(path_mismatch("issue_id"));
        }
        json_result(
            self.projects
                .move_issue_with_context(context, request)
                .await,
            StatusCode::OK,
        )
    }

    #[post("projects.web.issues.archive", "/api/issues/{issue_id}/archive")]
    async fn archive_issue(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<IssuePath>,
        Json(request): Json<projects::ArchiveIssueRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.issue_id != request.issue_id {
            return Ok(path_mismatch("issue_id"));
        }
        json_result(
            self.projects
                .archive_issue_with_context(context, request)
                .await,
            StatusCode::OK,
        )
    }

    #[get("projects.web.comments.list", "/api/issues/{issue_id}/comments")]
    async fn list_comments(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<IssuePath>,
        QueryParams(query): QueryParams<PageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.collaboration
                .list_comments_with_context(
                    context,
                    collaboration::ListCommentsRequest {
                        after: query.after,
                        issue_id: path.issue_id,
                        limit: query.limit,
                        organization_id: query.organization_id,
                    },
                )
                .await,
            StatusCode::OK,
        )
    }

    #[post("projects.web.comments.add", "/api/issues/{issue_id}/comments")]
    async fn add_comment(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<IssuePath>,
        Json(request): Json<collaboration::AddCommentRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.issue_id != request.issue_id {
            return Ok(path_mismatch("issue_id"));
        }
        json_result(
            self.collaboration
                .add_comment_with_context(context, request)
                .await,
            StatusCode::CREATED,
        )
    }

    #[patch("projects.web.comments.update", "/api/comments/{comment_id}")]
    async fn update_comment(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<CommentPath>,
        Json(request): Json<collaboration::UpdateCommentRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.comment_id != request.comment_id {
            return Ok(path_mismatch("comment_id"));
        }
        json_result(
            self.collaboration
                .update_comment_with_context(context, request)
                .await,
            StatusCode::OK,
        )
    }

    #[delete("projects.web.comments.delete", "/api/comments/{comment_id}")]
    async fn delete_comment(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<CommentPath>,
        Json(request): Json<collaboration::DeleteCommentRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.comment_id != request.comment_id {
            return Ok(path_mismatch("comment_id"));
        }
        json_result(
            self.collaboration
                .delete_comment_with_context(context, request)
                .await,
            StatusCode::OK,
        )
    }

    #[get("projects.web.updates.list", "/api/projects/{project_id}/updates")]
    async fn list_project_updates(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<ProjectPath>,
        QueryParams(query): QueryParams<PageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.collaboration
                .list_project_updates_with_context(
                    context,
                    collaboration::ListProjectUpdatesRequest {
                        after: query.after,
                        limit: query.limit,
                        organization_id: query.organization_id,
                        project_id: path.project_id,
                    },
                )
                .await,
            StatusCode::OK,
        )
    }

    #[post("projects.web.updates.create", "/api/projects/{project_id}/updates")]
    async fn create_project_update(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        Path(path): Path<ProjectPath>,
        Json(request): Json<collaboration::CreateProjectUpdateRequest>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        if path.project_id != request.project_id {
            return Ok(path_mismatch("project_id"));
        }
        json_result(
            self.collaboration
                .create_project_update_with_context(context, request)
                .await,
            StatusCode::CREATED,
        )
    }

    #[get("projects.web.catalog.teams", "/api/projects/catalog/teams")]
    async fn list_teams(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        QueryParams(query): QueryParams<PageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.admin
                .list_teams_with_context(
                    context,
                    admin::ListTeamsRequest {
                        after: query.after,
                        limit: query.limit,
                        organization_id: query.organization_id,
                    },
                )
                .await,
            StatusCode::OK,
        )
    }

    #[get(
        "projects.web.catalog.project-statuses",
        "/api/projects/catalog/project-statuses"
    )]
    async fn list_project_statuses(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        QueryParams(query): QueryParams<PageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.admin
                .list_project_statuses_with_context(
                    context,
                    admin::ListProjectStatusesRequest {
                        after: query.after,
                        limit: query.limit,
                        organization_id: query.organization_id,
                    },
                )
                .await,
            StatusCode::OK,
        )
    }

    #[get(
        "projects.web.catalog.workflow-states",
        "/api/projects/catalog/workflow-states"
    )]
    async fn list_workflow_states(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        QueryParams(query): QueryParams<TeamPageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.admin
                .list_workflow_states_with_context(context, query.into_workflow_request())
                .await,
            StatusCode::OK,
        )
    }

    #[get("projects.web.catalog.cycles", "/api/projects/catalog/cycles")]
    async fn list_cycles(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        QueryParams(query): QueryParams<TeamPageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.admin
                .list_cycles_with_context(context, query.into_cycle_request())
                .await,
            StatusCode::OK,
        )
    }

    #[get("projects.web.catalog.milestones", "/api/projects/catalog/milestones")]
    async fn list_milestones(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        QueryParams(query): QueryParams<ProjectPageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.admin
                .list_milestones_with_context(context, query.into_request())
                .await,
            StatusCode::OK,
        )
    }

    #[get("projects.web.catalog.labels", "/api/projects/catalog/labels")]
    async fn list_labels(
        &self,
        _actor: AuthenticatedUser,
        context: InvocationContext,
        QueryParams(query): QueryParams<TeamPageQuery>,
    ) -> Result<HandleResponse, EndpointHandleInvocationError> {
        json_result(
            self.admin
                .list_labels_with_context(context, query.into_labels_request())
                .await,
            StatusCode::OK,
        )
    }
}

#[derive(Debug)]
struct AuthenticatedUser;

impl FromRequest<ProjectsWebPlugin> for AuthenticatedUser {
    fn from_request<'a>(
        provider: &'a ProjectsWebPlugin,
        context: &'a mut InvocationContext,
        request: &'a HandleRequest,
    ) -> ExtractorFuture<'a, Self> {
        Box::pin(async move {
            let evidence = request
                .credential
                .as_ref()
                .map(|credential| CredentialEvidence::new(&credential.scheme, &credential.value));
            let response = provider
                .auth
                .authenticate_with_context(context.clone(), authenticate_request(evidence))
                .await
                .map_err(|error| -> ExtractorRejection {
                    match error {
                        auth::AuthInvocationError::Domain(_) => authentication_problem().into(),
                        auth::AuthInvocationError::Runtime(error) => {
                            EndpointHandleInvocationError::Runtime(error).into()
                        }
                    }
                })?;
            let outcome = decode_auth_response(response).map_err(|_| {
                EndpointHandleInvocationError::Runtime(RuntimeFailure::ProtocolViolation {
                    capability: auth::CAPABILITY_ID,
                })
            })?;
            let AuthOutcome::Authenticated(assertion) = outcome else {
                return Err(authentication_problem().into());
            };
            if assertion.actor_kind() != "user" {
                return Err(response::problem(
                    StatusCode::FORBIDDEN,
                    "unsupported_actor",
                    "This Web surface requires an authenticated user actor.",
                )
                .into());
            }
            *context = assertion.attach(context.clone()).map_err(|error| {
                EndpointHandleInvocationError::Runtime(RuntimeFailure::Internal {
                    detail: format!("could not attach authenticated actor assertion: {error}"),
                })
            })?;
            Ok(Self)
        })
    }
}

fn authentication_problem() -> HandleResponse {
    response::problem(
        StatusCode::UNAUTHORIZED,
        "authentication_required",
        "Provide a valid Bearer credential.",
    )
    .with_header(
        &header::WWW_AUTHENTICATE,
        &HeaderValue::from_static("Bearer"),
    )
    .expect("the static WWW-Authenticate header is valid")
}

fn asset(status: StatusCode, content_type: &str, body: &str) -> HandleResponse {
    HandleResponse {
        body: body.as_bytes().to_vec().into(),
        headers: vec![HandleResponseHeadersItem {
            name: "content-type".to_owned(),
            value: content_type.to_owned(),
        }],
        status: i64::from(status.as_u16()),
    }
}

fn path_mismatch(field: &str) -> HandleResponse {
    response::problem(
        StatusCode::BAD_REQUEST,
        "path_body_mismatch",
        format!("The path and JSON body must name the same {field}."),
    )
}

trait IntoWebError {
    fn into_web_error(self) -> Result<HandleResponse, EndpointHandleInvocationError>;
}

fn json_result<T, E>(
    result: Result<T, E>,
    status: StatusCode,
) -> Result<HandleResponse, EndpointHandleInvocationError>
where
    T: Serialize,
    E: IntoWebError,
{
    match result {
        Ok(value) => response::json(status, &value).map_err(Into::into),
        Err(error) => error.into_web_error(),
    }
}

fn domain_problem(
    capability: &'static str,
    error: &impl Debug,
) -> Result<HandleResponse, EndpointHandleInvocationError> {
    let variant = format!("{error:?}");
    if variant.starts_with("Unknown(") {
        return Err(EndpointHandleInvocationError::Runtime(
            RuntimeFailure::ProtocolViolation { capability },
        ));
    }
    let code = snake_case(&variant);
    let status = match variant.as_str() {
        "Unauthenticated" => StatusCode::UNAUTHORIZED,
        "Forbidden" => StatusCode::FORBIDDEN,
        "NotFound" | "PrivateTeam" => StatusCode::NOT_FOUND,
        "IdempotencyConflict"
        | "IdentifierConflict"
        | "RevisionConflict"
        | "RelationConflict"
        | "ActiveReference" => StatusCode::CONFLICT,
        _ => StatusCode::BAD_REQUEST,
    };
    let mut problem = response::problem(
        status,
        code.clone(),
        format!("The Projects capability rejected this operation ({code})."),
    );
    if status == StatusCode::UNAUTHORIZED {
        problem = problem.with_header(
            &header::WWW_AUTHENTICATE,
            &HeaderValue::from_static("Bearer"),
        )?;
    }
    Ok(problem)
}

fn snake_case(value: &str) -> String {
    let mut output = String::with_capacity(value.len() + 4);
    for (index, character) in value.chars().enumerate() {
        if character.is_ascii_uppercase() && index != 0 {
            output.push('_');
        }
        output.push(character.to_ascii_lowercase());
    }
    output
}

macro_rules! impl_web_error {
    ($type:path, $capability:expr) => {
        impl IntoWebError for $type {
            fn into_web_error(self) -> Result<HandleResponse, EndpointHandleInvocationError> {
                match self {
                    Self::Domain(error) => domain_problem($capability, &error),
                    Self::Runtime(error) => Err(EndpointHandleInvocationError::Runtime(error)),
                }
            }
        }
    };
}

impl_web_error!(
    projects::ProjectsArchiveIssueInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsArchiveProjectInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsCreateIssueInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsCreateProjectInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsGetIssueInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsGetProjectInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsListIssuesInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsListProjectsInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsMoveIssueInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsUpdateIssueInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    projects::ProjectsUpdateProjectInvocationError,
    projects::CAPABILITY_ID
);
impl_web_error!(
    collaboration::ProjectsCollaborationAddCommentInvocationError,
    collaboration::CAPABILITY_ID
);
impl_web_error!(
    collaboration::ProjectsCollaborationCreateProjectUpdateInvocationError,
    collaboration::CAPABILITY_ID
);
impl_web_error!(
    collaboration::ProjectsCollaborationDeleteCommentInvocationError,
    collaboration::CAPABILITY_ID
);
impl_web_error!(
    collaboration::ProjectsCollaborationListCommentsInvocationError,
    collaboration::CAPABILITY_ID
);
impl_web_error!(
    collaboration::ProjectsCollaborationListProjectUpdatesInvocationError,
    collaboration::CAPABILITY_ID
);
impl_web_error!(
    collaboration::ProjectsCollaborationUpdateCommentInvocationError,
    collaboration::CAPABILITY_ID
);
impl_web_error!(
    admin::ProjectsAdminListCyclesInvocationError,
    admin::CAPABILITY_ID
);
impl_web_error!(
    admin::ProjectsAdminListLabelsInvocationError,
    admin::CAPABILITY_ID
);
impl_web_error!(
    admin::ProjectsAdminListMilestonesInvocationError,
    admin::CAPABILITY_ID
);
impl_web_error!(
    admin::ProjectsAdminListProjectStatusesInvocationError,
    admin::CAPABILITY_ID
);
impl_web_error!(
    admin::ProjectsAdminListTeamsInvocationError,
    admin::CAPABILITY_ID
);
impl_web_error!(
    admin::ProjectsAdminListWorkflowStatesInvocationError,
    admin::CAPABILITY_ID
);

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ProjectPath {
    project_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct IssuePath {
    issue_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct IssueRefPath {
    issue_ref: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CommentPath {
    comment_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct OrganizationQuery {
    organization_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ListProjectsQuery {
    organization_id: String,
    #[serde(default)]
    team_id: Option<String>,
    #[serde(default)]
    include_archived: bool,
    #[serde(default)]
    after: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
}

impl ListProjectsQuery {
    fn into_request(self) -> projects::ListProjectsRequest {
        projects::ListProjectsRequest {
            after: self.after,
            include_archived: self.include_archived,
            limit: self.limit,
            organization_id: self.organization_id,
            team_id: self.team_id,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ListIssuesQuery {
    organization_id: String,
    #[serde(default)]
    team_id: Option<String>,
    #[serde(default)]
    workflow_state_id: Option<String>,
    #[serde(default)]
    include_archived: bool,
    #[serde(default)]
    after: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
}

impl ListIssuesQuery {
    fn into_request(self, project_id: String) -> projects::ListIssuesRequest {
        projects::ListIssuesRequest {
            after: self.after,
            include_archived: self.include_archived,
            limit: self.limit,
            organization_id: self.organization_id,
            project_id: Some(project_id),
            team_id: self.team_id,
            workflow_state_id: self.workflow_state_id,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PageQuery {
    organization_id: String,
    #[serde(default)]
    after: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct TeamPageQuery {
    organization_id: String,
    team_id: String,
    #[serde(default)]
    after: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
}

impl TeamPageQuery {
    fn into_workflow_request(self) -> admin::ListWorkflowStatesRequest {
        admin::ListWorkflowStatesRequest {
            after: self.after,
            limit: self.limit,
            organization_id: self.organization_id,
            team_id: self.team_id,
        }
    }

    fn into_cycle_request(self) -> admin::ListCyclesRequest {
        admin::ListCyclesRequest {
            after: self.after,
            limit: self.limit,
            organization_id: self.organization_id,
            team_id: self.team_id,
        }
    }

    fn into_labels_request(self) -> admin::ListLabelsRequest {
        admin::ListLabelsRequest {
            after: self.after,
            limit: self.limit,
            organization_id: self.organization_id,
            team_id: Some(self.team_id),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ProjectPageQuery {
    organization_id: String,
    project_id: String,
    #[serde(default)]
    after: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
}

impl ProjectPageQuery {
    fn into_request(self) -> admin::ListMilestonesRequest {
        admin::ListMilestonesRequest {
            after: self.after,
            limit: self.limit,
            organization_id: self.organization_id,
            project_id: self.project_id,
        }
    }
}

const fn default_limit() -> i64 {
    50
}

#[cfg(test)]
mod tests {
    use futures::executor::block_on;
    use lenso_capability_http_endpoint::testing::EndpointTest;

    use super::*;

    #[test]
    fn serves_self_contained_page_and_assets_without_connected_ports() {
        block_on(async {
            let endpoint = EndpointTest::new(ProjectsWebPlugin::default());
            let page = endpoint.request("projects.web.page").send().await.unwrap();
            assert_eq!(page.status(), StatusCode::OK);
            assert_eq!(
                page.header("content-type"),
                Some("text/html; charset=utf-8")
            );
            assert!(page.into_inner().body.starts_with(b"<!doctype html>"));

            let css = endpoint.request("projects.web.css").send().await.unwrap();
            assert_eq!(css.header("content-type"), Some("text/css; charset=utf-8"));
            assert!(css.into_inner().body.contains(&b"a"[0]));

            let javascript = endpoint.request("projects.web.js").send().await.unwrap();
            assert_eq!(
                javascript.header("content-type"),
                Some("text/javascript; charset=utf-8")
            );
            assert!(
                javascript
                    .into_inner()
                    .body
                    .windows(9)
                    .any(|chunk| chunk == b"/api/proj")
            );
        });
    }

    #[test]
    fn descriptor_declares_exact_provided_and_required_capabilities() {
        let descriptor: serde_json::Value = serde_json::from_str(PLUGIN_DESCRIPTOR_JSON).unwrap();
        let provided = descriptor["provided_capabilities"].as_array().unwrap();
        assert_eq!(provided.len(), 1);
        assert_eq!(provided[0]["capability_id"], "lenso.http.endpoint@1");
        assert_eq!(provided[0]["descriptor_version"], "1.1.0");

        let mut required = descriptor["required_capabilities"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| {
                (
                    entry["capability_id"].as_str().unwrap(),
                    entry["descriptor_version"].as_str().unwrap(),
                    entry["cardinality"].as_str().unwrap(),
                )
            })
            .collect::<Vec<_>>();
        required.sort_unstable();
        assert_eq!(
            required,
            vec![
                ("lenso.auth@1", "1.0.0", "one"),
                ("lenso.projects-admin@1", "1.0.0", "one"),
                ("lenso.projects-collaboration@1", "1.0.0", "one"),
                ("lenso.projects@1", "1.0.0", "one"),
            ]
        );
    }

    #[test]
    fn maps_visibility_conflict_and_validation_errors_intentionally() {
        assert_eq!(
            domain_problem(
                projects::CAPABILITY_ID,
                &projects::ListProjectsError::PrivateTeam
            )
            .unwrap()
            .status,
            404
        );
        assert_eq!(
            domain_problem(
                projects::CAPABILITY_ID,
                &projects::UpdateProjectError::RevisionConflict
            )
            .unwrap()
            .status,
            409
        );
        assert_eq!(
            domain_problem(
                projects::CAPABILITY_ID,
                &projects::CreateProjectError::InvalidRequest
            )
            .unwrap()
            .status,
            400
        );
    }
}

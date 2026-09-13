//! Same-process adapter: fixed routes through a bound Projects Web endpoint.
//! No TCP client or shared user credential participates in this path.
use lenso_capability_http_endpoint as http;
use lenso_kernel::InvocationContext;
use serde_json::{Value, json};

pub(super) async fn invoke(
    web: &http::EndpointClient,
    context: InvocationContext,
    operation: &str,
    body: Value,
) -> Result<Value, ()> {
    let (route, field) = match operation {
        "connection_status" => ("projects.web.session", None),
        "list_workspaces" => ("projects.web.workspaces", None),
        "list_projects" => ("projects.web.projects.list", None),
        "get_project" => ("projects.web.projects.detail", Some("project_id")),
        "create_project" => ("projects.web.projects.create", None),
        "create_issue" => ("projects.web.issues.create", Some("project_id")),
        "list_team_issues" => ("projects.web.team-issues.list", Some("team_id")),
        "list_issues" => ("projects.web.issues.list", Some("project_id")),
        "get_issue" => ("projects.web.issues.detail", Some("issue_ref")),
        "update_issue" => ("projects.web.issues.update", Some("issue_id")),
        "get_assignee" => ("projects.web.issues.assignee", Some("issue_id")),
        "set_assignee" => ("projects.web.issues.assign", Some("issue_id")),
        "list_assignees" => ("projects.web.issues.assignees", Some("issue_id")),
        "list_activity" => ("projects.web.issues.activity", Some("issue_id")),
        "list_teams" => ("projects.web.catalog.teams", None),
        "list_project_statuses" => ("projects.web.catalog.project-statuses", None),
        "list_workflow_states" => ("projects.web.catalog.workflow-states", None),
        _ => return Err(()),
    };
    let (url, method) = if operation == "connection_status" {
        (
            reqwest::Url::parse("http://workspace.invalid/api/projects/session").map_err(|_| ())?,
            reqwest::Method::GET,
        )
    } else {
        super::connection::endpoint("http://workspace.invalid", operation, &body)?
    };
    let path_parameters = field
        .map(|field| {
            let key = if field == "issue_ref" {
                "issue_id"
            } else {
                field
            };
            body[key]
                .as_str()
                .map(|value| http::HandleRequestPathParametersItem {
                    name: field.into(),
                    value: value.into(),
                })
                .ok_or(())
        })
        .transpose()?
        .into_iter()
        .collect();
    let response = web
        .handle_with_context(
            context,
            http::HandleRequest {
                route_id: route.into(),
                request_id: uuid::Uuid::new_v4().to_string(),
                method: method.to_string(),
                path: url.path().into(),
                query: url.query().map(str::to_owned),
                path_parameters,
                headers: vec![http::HandleRequestHeadersItem {
                    name: "content-type".into(),
                    value: "application/json".into(),
                }],
                credential: None,
                body: serde_json::to_vec(&body).map_err(|_| ())?.into(),
            },
        )
        .await
        .map_err(|_| ())?;
    if response.body.len() > super::MAX_RESPONSE_BYTES {
        return Err(());
    }
    let value: Value = serde_json::from_slice(&response.body).map_err(|_| ())?;
    if operation == "connection_status" {
        return Ok(
            json!({"connected":response.status == 200,"mode":"console","label":"Console","subject":value["subject"]}),
        );
    }
    Ok(json!({"status":response.status,"body":value}))
}

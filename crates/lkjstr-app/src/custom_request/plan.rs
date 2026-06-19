#![doc = "Custom Request run planning."]

use lkjstr_relays::DemandVisibility;

use crate::{
    CustomRequestQueryInput, QueryDemandInput, custom_request_query_input, plan_query_demand,
};

use super::relay_limits::apply_custom_request_relay_limits;
use super::{CustomRequest, CustomRequestError, CustomRequestMode, CustomRequestRelayLimitInput};
use super::{custom_request_mode, parse_custom_request};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CustomRequestRunStatus {
    Ready,
    Invalid,
    NoRelay,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequestRunInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub raw_json: String,
    pub now_sec: u64,
    pub page_size: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequestRunPlan {
    pub status: CustomRequestRunStatus,
    pub request: Option<CustomRequest>,
    pub mode: Option<CustomRequestMode>,
    pub demand: Option<QueryDemandInput>,
    pub error: Option<CustomRequestError>,
    pub relays: Vec<String>,
}

#[must_use]
pub fn plan_custom_request_run(input: CustomRequestRunInput) -> CustomRequestRunPlan {
    plan_custom_request_run_with_relay_limits(input, Vec::new())
}

#[must_use]
pub fn plan_custom_request_run_with_relay_limits(
    input: CustomRequestRunInput,
    relay_limits: Vec<CustomRequestRelayLimitInput>,
) -> CustomRequestRunPlan {
    let request = match parse_custom_request(&input.raw_json) {
        Ok(request) => request,
        Err(error) => return invalid(error),
    };
    let mode = custom_request_mode(&request.filters);
    let demand = custom_request_query_input(CustomRequestQueryInput {
        owner: input.owner,
        visibility: input.visibility,
        selected_relays: input.selected_relays,
        disabled_relays: input.disabled_relays,
        request: request.clone(),
        now_sec: input.now_sec,
        page_size: input.page_size,
    });
    let relays = plan_query_demand(demand.clone()).demand.relays;
    if relays.is_empty() {
        return no_relay(request, mode);
    }
    let request = apply_custom_request_relay_limits(request, &relays, &relay_limits);
    CustomRequestRunPlan {
        status: CustomRequestRunStatus::Ready,
        request: Some(request),
        mode: Some(mode),
        demand: Some(demand),
        error: None,
        relays,
    }
}

fn no_relay(request: CustomRequest, mode: CustomRequestMode) -> CustomRequestRunPlan {
    CustomRequestRunPlan {
        status: CustomRequestRunStatus::NoRelay,
        request: Some(request),
        mode: Some(mode),
        demand: None,
        error: None,
        relays: Vec::new(),
    }
}

fn invalid(error: CustomRequestError) -> CustomRequestRunPlan {
    CustomRequestRunPlan {
        status: CustomRequestRunStatus::Invalid,
        request: None,
        mode: None,
        demand: None,
        error: Some(error),
        relays: Vec::new(),
    }
}

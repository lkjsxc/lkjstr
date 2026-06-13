use lkjstr_protocol::FollowEntry;

use crate::follow_graph::{FollowListSummary, TargetFollowListState};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FolloweesStatus {
    MissingPubkey,
    Loading,
    Ready,
    Empty,
    NotFound,
    PartialFailure,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesDiagnostic {
    pub row_id: String,
    pub relay: Option<String>,
    pub message: String,
    pub retry_available: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesRow {
    pub row_id: String,
    pub pubkey: String,
    pub relay: Option<String>,
    pub petname: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesView {
    pub owner: String,
    pub target_pubkey: Option<String>,
    pub status: FolloweesStatus,
    pub message: String,
    pub diagnostics: Vec<FolloweesDiagnostic>,
    pub rows: Vec<FolloweesRow>,
    pub following_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesViewInput {
    pub owner: String,
    pub target_pubkey: Option<String>,
    pub entries: Vec<FollowEntry>,
    pub state: TargetFollowListState,
}

#[must_use]
pub fn default_followees_view(owner: &str, target_pubkey: Option<String>) -> FolloweesView {
    let status = if target_pubkey.is_some() {
        FolloweesStatus::Loading
    } else {
        FolloweesStatus::MissingPubkey
    };
    FolloweesView {
        owner: owner.to_owned(),
        target_pubkey,
        status,
        message: followees_status_message(status).to_owned(),
        diagnostics: Vec::new(),
        rows: Vec::new(),
        following_count: 0,
    }
}

#[must_use]
pub fn followees_view_from_summary(
    owner: &str,
    target_pubkey: Option<String>,
    state: TargetFollowListState,
    summary: FollowListSummary,
) -> FolloweesView {
    build_followees_view(FolloweesViewInput {
        owner: owner.to_owned(),
        target_pubkey,
        entries: summary.entries,
        state,
    })
}

#[must_use]
pub fn followees_retryable_failure_view(
    owner: &str,
    target_pubkey: Option<String>,
    relays: &[String],
) -> FolloweesView {
    let mut view = followees_view_from_summary(
        owner,
        target_pubkey,
        TargetFollowListState::PartialFailure,
        empty_summary(),
    );
    view.message = retryable_failure_message(relays.len());
    view.diagnostics = selected_relay_diagnostics(relays);
    view
}

#[must_use]
pub fn build_followees_view(input: FolloweesViewInput) -> FolloweesView {
    if input.target_pubkey.is_none() {
        return default_followees_view(&input.owner, None);
    }
    let rows = input
        .entries
        .into_iter()
        .map(followee_row)
        .collect::<Vec<_>>();
    let status = followees_status(input.state, rows.len());
    FolloweesView {
        owner: input.owner,
        target_pubkey: input.target_pubkey,
        status,
        message: followees_status_message(status).to_owned(),
        diagnostics: Vec::new(),
        following_count: rows.len(),
        rows,
    }
}

#[must_use]
pub const fn followees_status_message(status: FolloweesStatus) -> &'static str {
    match status {
        FolloweesStatus::MissingPubkey => "Followees target unavailable.",
        FolloweesStatus::Loading => "Loading following list...",
        FolloweesStatus::Ready => "Public follow list found.",
        FolloweesStatus::Empty => "Follow list has no valid pubkeys.",
        FolloweesStatus::NotFound => "No public follow list was found.",
        FolloweesStatus::PartialFailure => {
            "Follow-list discovery incomplete. Retry or inspect relay diagnostics."
        }
        FolloweesStatus::Failed => "Follow-list relay reads failed.",
        FolloweesStatus::Cancelled => "Follow-list discovery was cancelled.",
    }
}

fn followees_status(state: TargetFollowListState, row_count: usize) -> FolloweesStatus {
    match state {
        TargetFollowListState::Idle
        | TargetFollowListState::ReadingSelected
        | TargetFollowListState::ReadingAuthorRoutes
        | TargetFollowListState::ReadingReceiptRoutes
        | TargetFollowListState::ReadingDiscovery => FolloweesStatus::Loading,
        TargetFollowListState::CacheHit | TargetFollowListState::Found => {
            if row_count == 0 {
                FolloweesStatus::Empty
            } else {
                FolloweesStatus::Ready
            }
        }
        TargetFollowListState::EmptyFollowList => FolloweesStatus::Empty,
        TargetFollowListState::NotFoundProven => FolloweesStatus::NotFound,
        TargetFollowListState::PartialFailure => FolloweesStatus::PartialFailure,
        TargetFollowListState::AllFailed => FolloweesStatus::Failed,
        TargetFollowListState::Aborted => FolloweesStatus::Cancelled,
    }
}

fn followee_row(entry: FollowEntry) -> FolloweesRow {
    let pubkey = entry.pubkey;
    FolloweesRow {
        row_id: format!("followee:{pubkey}"),
        pubkey,
        relay: entry.relay,
        petname: entry.petname,
    }
}

fn retryable_failure_message(relay_count: usize) -> String {
    format!(
        "Follow-list discovery incomplete after {relay_count} selected relay read. Retry available."
    )
}

fn selected_relay_diagnostics(relays: &[String]) -> Vec<FolloweesDiagnostic> {
    relays
        .iter()
        .enumerate()
        .map(|(index, relay)| FolloweesDiagnostic {
            row_id: format!("followees-diagnostic:selected:{index}"),
            relay: Some(relay.clone()),
            message: "Selected relay did not return a follow list before the read ended."
                .to_owned(),
            retry_available: true,
        })
        .collect()
}

fn empty_summary() -> FollowListSummary {
    FollowListSummary {
        entries: Vec::new(),
        following_count: 0,
    }
}

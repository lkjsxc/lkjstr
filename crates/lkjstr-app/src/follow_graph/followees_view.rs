use lkjstr_protocol::FollowEntry;

use crate::follow_graph::{
    FollowListSummary, FolloweesProfile, FolloweesRow, FolloweesStatus, FolloweesView,
    FolloweesViewInput, TargetFollowListState,
};

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
        target_profile: None,
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
        profiles: Vec::new(),
        state,
    })
}

#[must_use]
pub fn followees_view_from_summary_with_profiles(
    owner: &str,
    target_pubkey: Option<String>,
    state: TargetFollowListState,
    summary: FollowListSummary,
    profiles: Vec<FolloweesProfile>,
) -> FolloweesView {
    build_followees_view(FolloweesViewInput {
        owner: owner.to_owned(),
        target_pubkey,
        entries: summary.entries,
        profiles,
        state,
    })
}

#[must_use]
pub fn build_followees_view(input: FolloweesViewInput) -> FolloweesView {
    if input.target_pubkey.is_none() {
        return default_followees_view(&input.owner, None);
    }
    let rows = input
        .entries
        .into_iter()
        .map(|entry| followee_row(entry, &input.profiles))
        .collect::<Vec<_>>();
    let status = followees_status(input.state, rows.len());
    let target_profile = target_profile(input.target_pubkey.as_deref(), &input.profiles);
    FolloweesView {
        owner: input.owner,
        target_pubkey: input.target_pubkey,
        target_profile,
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

fn followee_row(entry: FollowEntry, profiles: &[FolloweesProfile]) -> FolloweesRow {
    let pubkey = entry.pubkey;
    let profile = followee_profile(&pubkey, profiles);
    FolloweesRow {
        row_id: format!("followee:{pubkey}"),
        pubkey,
        relay: entry.relay,
        petname: entry.petname,
        display_name: profile.and_then(|item| item.display_name.clone()),
        subtitle: profile.and_then(|item| item.subtitle.clone()),
        avatar_url: profile.and_then(|item| item.avatar_url.clone()),
    }
}

fn followee_profile<'a>(
    pubkey: &str,
    profiles: &'a [FolloweesProfile],
) -> Option<&'a FolloweesProfile> {
    profiles.iter().find(|profile| profile.pubkey == pubkey)
}

fn target_profile(pubkey: Option<&str>, profiles: &[FolloweesProfile]) -> Option<FolloweesProfile> {
    followee_profile(pubkey?, profiles).cloned()
}

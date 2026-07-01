#![doc = "Pure startup policy for degraded post-display surfaces."]

use crate::{
    ProtectedAccountAvailability,
    read_availability::{EffectiveReadRelays, ReadRelaySource},
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SurfaceStartupAccount {
    PublicTarget { present: bool },
    Protected(ProtectedAccountAvailability),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SurfaceStartupCacheState {
    Pending,
    Complete { empty_is_proven: bool },
    Partial { retry_available: bool },
    Unavailable { retry_available: bool },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SurfaceStartupRelayState {
    NotStarted,
    Requested,
    Progressive,
    CompleteEmpty,
    Failed,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SurfaceStartupAction {
    RenderCache,
    RequestRelay,
    RenderDiagnosticWithContent,
    Loading,
    Partial,
    Blocked,
    ProvenEmpty,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SurfaceStartupBlockReason {
    MissingTarget,
    NoActiveAccount,
    ProtectedAccountUnavailable,
    NoEnabledRelay,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SurfaceStartupInput {
    pub account: SurfaceStartupAccount,
    pub read_plan: EffectiveReadRelays,
    pub author_route_count: usize,
    pub cache_state: SurfaceStartupCacheState,
    pub relay_state: SurfaceStartupRelayState,
    pub content_present: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SurfaceStartupDecision {
    pub action: SurfaceStartupAction,
    pub block_reason: Option<SurfaceStartupBlockReason>,
    pub can_request_relay: bool,
}

#[must_use]
pub fn surface_startup_policy(input: SurfaceStartupInput) -> SurfaceStartupDecision {
    if let Some(decision) = account_decision(&input.account) {
        return decision;
    }
    let route_available = input.read_plan.has_read_relays() || input.author_route_count > 0;
    if !route_available {
        return no_route_decision(input.content_present);
    }
    if input.content_present {
        return content_decision(&input);
    }
    no_content_decision(&input)
}

fn account_decision(account: &SurfaceStartupAccount) -> Option<SurfaceStartupDecision> {
    match account {
        SurfaceStartupAccount::PublicTarget { present: true }
        | SurfaceStartupAccount::Protected(ProtectedAccountAvailability::Selected { .. }) => None,
        SurfaceStartupAccount::PublicTarget { present: false } => {
            Some(blocked(SurfaceStartupBlockReason::MissingTarget, false))
        }
        SurfaceStartupAccount::Protected(ProtectedAccountAvailability::Loading) => {
            Some(decision(SurfaceStartupAction::Loading, None, false))
        }
        SurfaceStartupAccount::Protected(
            ProtectedAccountAvailability::NoAccounts
            | ProtectedAccountAvailability::NoSelectedAccount,
        ) => Some(blocked(SurfaceStartupBlockReason::NoActiveAccount, false)),
        SurfaceStartupAccount::Protected(
            ProtectedAccountAvailability::SelectorUnavailable { .. }
            | ProtectedAccountAvailability::StorageBusy { .. }
            | ProtectedAccountAvailability::StorageBlocked { .. }
            | ProtectedAccountAvailability::StorageUnsupported { .. },
        ) => Some(blocked(
            SurfaceStartupBlockReason::ProtectedAccountUnavailable,
            false,
        )),
    }
}

fn no_route_decision(content_present: bool) -> SurfaceStartupDecision {
    if content_present {
        return decision(
            SurfaceStartupAction::RenderDiagnosticWithContent,
            Some(SurfaceStartupBlockReason::NoEnabledRelay),
            false,
        );
    }
    blocked(SurfaceStartupBlockReason::NoEnabledRelay, false)
}

fn content_decision(input: &SurfaceStartupInput) -> SurfaceStartupDecision {
    if has_diagnostic(input) {
        decision(
            SurfaceStartupAction::RenderDiagnosticWithContent,
            None,
            input.read_plan.has_read_relays() || input.author_route_count > 0,
        )
    } else {
        decision(SurfaceStartupAction::RenderCache, None, true)
    }
}

fn no_content_decision(input: &SurfaceStartupInput) -> SurfaceStartupDecision {
    match (input.cache_state, input.relay_state) {
        (
            SurfaceStartupCacheState::Complete {
                empty_is_proven: true,
            },
            _,
        ) => decision(SurfaceStartupAction::ProvenEmpty, None, false),
        (_, SurfaceStartupRelayState::Requested | SurfaceStartupRelayState::Progressive)
        | (SurfaceStartupCacheState::Pending, _)
        | (
            SurfaceStartupCacheState::Partial { .. } | SurfaceStartupCacheState::Unavailable { .. },
            SurfaceStartupRelayState::NotStarted,
        ) => decision(SurfaceStartupAction::RequestRelay, None, true),
        (_, SurfaceStartupRelayState::CompleteEmpty | SurfaceStartupRelayState::Failed) => {
            decision(SurfaceStartupAction::Partial, None, true)
        }
        _ => decision(SurfaceStartupAction::Loading, None, true),
    }
}

fn has_diagnostic(input: &SurfaceStartupInput) -> bool {
    input.read_plan.diagnostic.is_some()
        || !matches!(input.read_plan.source, ReadRelaySource::DurableSettings)
        || matches!(
            input.cache_state,
            SurfaceStartupCacheState::Partial { .. } | SurfaceStartupCacheState::Unavailable { .. }
        )
        || matches!(input.relay_state, SurfaceStartupRelayState::Failed)
}

fn blocked(reason: SurfaceStartupBlockReason, can_request_relay: bool) -> SurfaceStartupDecision {
    decision(
        SurfaceStartupAction::Blocked,
        Some(reason),
        can_request_relay,
    )
}

fn decision(
    action: SurfaceStartupAction,
    block_reason: Option<SurfaceStartupBlockReason>,
    can_request_relay: bool,
) -> SurfaceStartupDecision {
    SurfaceStartupDecision {
        action,
        block_reason,
        can_request_relay,
    }
}

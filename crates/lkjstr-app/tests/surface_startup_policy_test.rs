use lkjstr_app::{
    ProtectedAccountAvailability,
    read_availability::{
        EffectiveReadRelays, SessionDefaultReadPolicy,
        surface_startup_policy::{
            SurfaceStartupAccount, SurfaceStartupAction, SurfaceStartupBlockReason,
            SurfaceStartupCacheState, SurfaceStartupInput, SurfaceStartupRelayState,
            surface_startup_policy,
        },
    },
};

#[test]
fn protected_page_account_with_session_default_relays_requests_relay() {
    let decision = surface_startup_policy(SurfaceStartupInput {
        account: SurfaceStartupAccount::Protected(ProtectedAccountAvailability::selected(pubkey())),
        read_plan: fallback_plan(),
        author_route_count: 0,
        cache_state: SurfaceStartupCacheState::Unavailable {
            retry_available: true,
        },
        relay_state: SurfaceStartupRelayState::NotStarted,
        content_present: false,
    });

    assert_eq!(decision.action, SurfaceStartupAction::RequestRelay);
    assert_eq!(decision.block_reason, None);
    assert!(decision.can_request_relay);
}

#[test]
fn relay_content_with_storage_diagnostics_renders_content() {
    let decision = surface_startup_policy(SurfaceStartupInput {
        account: SurfaceStartupAccount::PublicTarget { present: true },
        read_plan: fallback_plan(),
        author_route_count: 0,
        cache_state: SurfaceStartupCacheState::Unavailable {
            retry_available: true,
        },
        relay_state: SurfaceStartupRelayState::Progressive,
        content_present: true,
    });

    assert_eq!(
        decision.action,
        SurfaceStartupAction::RenderDiagnosticWithContent
    );
    assert!(decision.can_request_relay);
}

#[test]
fn durable_empty_relays_block_only_without_content_or_author_routes() {
    let decision = surface_startup_policy(SurfaceStartupInput {
        account: SurfaceStartupAccount::PublicTarget { present: true },
        read_plan: EffectiveReadRelays::from_durable_settings(Vec::new()),
        author_route_count: 0,
        cache_state: SurfaceStartupCacheState::Pending,
        relay_state: SurfaceStartupRelayState::NotStarted,
        content_present: false,
    });

    assert_eq!(decision.action, SurfaceStartupAction::Blocked);
    assert_eq!(
        decision.block_reason,
        Some(SurfaceStartupBlockReason::NoEnabledRelay)
    );
}

#[test]
fn proven_empty_requires_explicit_empty_proof() {
    let decision = surface_startup_policy(SurfaceStartupInput {
        account: SurfaceStartupAccount::PublicTarget { present: true },
        read_plan: durable_plan(),
        author_route_count: 0,
        cache_state: SurfaceStartupCacheState::Complete {
            empty_is_proven: true,
        },
        relay_state: SurfaceStartupRelayState::CompleteEmpty,
        content_present: false,
    });

    assert_eq!(decision.action, SurfaceStartupAction::ProvenEmpty);
}

fn fallback_plan() -> EffectiveReadRelays {
    EffectiveReadRelays::from_unavailable(
        "opfs-owner-held",
        SessionDefaultReadPolicy::Allowed,
        vec!["wss://relay.example".to_owned()],
    )
}

fn durable_plan() -> EffectiveReadRelays {
    EffectiveReadRelays::from_durable_settings(vec!["wss://relay.example".to_owned()])
}

fn pubkey() -> String {
    "a".repeat(64)
}

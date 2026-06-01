use lkjstr_protocol::{KIND_REACTION, KIND_TEXT_NOTE, NostrFilter};
use lkjstr_relays::{
    Demand, DemandPhase, DemandPurpose, DemandSurface, DemandVisibility, IngressDecision,
    LiveLeaseEffectKind, LiveLeaseState,
};

#[test]
fn first_visible_attach_opens_and_matching_attach_shares() -> Result<(), String> {
    let mut state = LiveLeaseState::new();
    let first = state.attach(demand("tab-a", DemandVisibility::Visible), now_sec());
    let second = state.attach(demand("tab-b", DemandVisibility::Visible), now_sec());
    let [effect] = first.effects.as_slice() else {
        return Err("wanted open effect".to_owned());
    };

    assert_eq!(effect.kind, LiveLeaseEffectKind::OpenWire);
    assert!(second.effects.is_empty());
    assert_eq!(state.counts().active_demands, 2);
    assert_eq!(state.counts().open_live_leases, 1);
    assert_eq!(state.counts().relay_req_total, 1);
    Ok(())
}

#[test]
fn last_visible_release_closes_wire() -> Result<(), String> {
    let mut state = LiveLeaseState::new();
    let first = state.attach(demand("tab-a", DemandVisibility::Visible), now_sec());
    state.attach(demand("tab-b", DemandVisibility::Visible), now_sec());
    let Some(snapshot) = first.snapshot else {
        return Err("wanted first snapshot".to_owned());
    };
    let keep = state.release("tab-a", &snapshot.fingerprint);
    let close = state.release("tab-b", &snapshot.fingerprint);
    let [effect] = close.effects.as_slice() else {
        return Err("wanted close effect".to_owned());
    };

    assert!(keep.effects.is_empty());
    assert_eq!(effect.kind, LiveLeaseEffectKind::CloseWire);
    assert_eq!(state.counts().open_live_leases, 0);
    assert_eq!(state.counts().relay_close_total, 1);
    Ok(())
}

#[test]
fn visibility_changes_suspend_and_resume_wire() -> Result<(), String> {
    let mut state = LiveLeaseState::new();
    let hidden = state.attach(demand("tab-a", DemandVisibility::Hidden), now_sec());
    let resume = state.set_owner_visibility("tab-a", DemandVisibility::Visible);
    let suspend = state.set_owner_visibility("tab-a", DemandVisibility::Hidden);
    let [resume_effect] = resume.effects.as_slice() else {
        return Err("wanted resume effect".to_owned());
    };
    let [suspend_effect] = suspend.effects.as_slice() else {
        return Err("wanted suspend effect".to_owned());
    };

    assert!(hidden.effects.is_empty());
    assert_eq!(resume_effect.kind, LiveLeaseEffectKind::ResumeWire);
    assert_eq!(suspend_effect.kind, LiveLeaseEffectKind::SuspendWire);
    assert_eq!(state.counts().relay_req_total, 1);
    assert_eq!(state.counts().relay_close_total, 1);
    Ok(())
}

#[test]
fn ingress_counter_tracks_accepts_and_drops() {
    let mut state = LiveLeaseState::new();
    let accepted = state.classify_ingress(DemandSurface::Home, KIND_TEXT_NOTE);
    let dropped = state.classify_ingress(DemandSurface::Home, KIND_REACTION);

    assert_eq!(accepted.decision, IngressDecision::Accept);
    assert_eq!(dropped.decision, IngressDecision::DropNonRenderCritical);
    assert_eq!(dropped.counts.events_received, 2);
    assert_eq!(dropped.counts.events_accepted, 1);
    assert_eq!(dropped.counts.events_dropped_non_render_critical, 1);
}

fn demand(owner: &str, visibility: DemandVisibility) -> Demand {
    Demand {
        surface: DemandSurface::Home,
        phase: DemandPhase::Live,
        relays: vec!["wss://relay.example".to_owned()],
        filters: vec![NostrFilter {
            kinds: Some(vec![KIND_TEXT_NOTE]),
            since: Some(now_sec()),
            limit: Some(30),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::Feed,
        owner: owner.to_owned(),
        visibility,
        priority: None,
        since: Some(now_sec()),
        until: None,
        limit: None,
        staleness_ms: None,
        channel: Some("notes".to_owned()),
    }
}

const fn now_sec() -> u64 {
    1_700_000_030
}

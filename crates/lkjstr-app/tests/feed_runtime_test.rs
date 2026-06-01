use lkjstr_app::{
    FeedRuntimeInput, FeedWindowEvidence, FeedWindowFlags, QueryDemandInput, QuerySurface,
    attach_feed_runtime_live, reduce_feed_runtime_window, release_feed_runtime_live,
    set_feed_runtime_visibility, start_feed_runtime,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent, NostrFilter};
use lkjstr_relays::{
    AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility, LiveLeaseEffectKind,
    LiveLeaseState, ProgressiveEvent,
};

#[test]
fn live_attach_normalizes_owner_and_opens_wire() -> Result<(), String> {
    let runtime = runtime("tab-a");
    let outcome = attach_feed_runtime_live(
        runtime,
        LiveLeaseState::new(),
        input("wrong-owner", DemandVisibility::Visible),
    );
    let [effect] = outcome.effects.as_slice() else {
        return Err("wanted open effect".to_owned());
    };

    assert_eq!(effect.kind, LiveLeaseEffectKind::OpenWire);
    assert_eq!(outcome.plan.demand.owner, "tab-a");
    assert_eq!(
        outcome.runtime.live_fingerprint,
        Some(outcome.plan.fingerprint)
    );
    assert_eq!(outcome.leases.counts().active_demands, 1);
    Ok(())
}

#[test]
fn compatible_runtimes_share_live_lease_and_close_on_last_release() -> Result<(), String> {
    let first = attach_feed_runtime_live(
        runtime("tab-a"),
        LiveLeaseState::new(),
        input("tab-a", DemandVisibility::Visible),
    );
    let second = attach_feed_runtime_live(
        runtime("tab-b"),
        first.leases,
        input("tab-b", DemandVisibility::Visible),
    );
    let released_a = release_feed_runtime_live(first.runtime, second.leases);
    let released_b = release_feed_runtime_live(second.runtime, released_a.leases);
    let [close] = released_b.effects.as_slice() else {
        return Err("wanted close effect".to_owned());
    };

    assert!(second.effects.is_empty());
    assert!(released_a.effects.is_empty());
    assert_eq!(close.kind, LiveLeaseEffectKind::CloseWire);
    assert_eq!(released_b.leases.counts().active_demands, 0);
    Ok(())
}

#[test]
fn visibility_changes_emit_shared_live_effects() -> Result<(), String> {
    let attached = attach_feed_runtime_live(
        runtime("tab-a"),
        LiveLeaseState::new(),
        input("tab-a", DemandVisibility::Hidden),
    );
    let resumed =
        set_feed_runtime_visibility(attached.runtime, attached.leases, DemandVisibility::Visible);
    let suspended =
        set_feed_runtime_visibility(resumed.runtime, resumed.leases, DemandVisibility::Hidden);
    let [resume] = resumed.effects.as_slice() else {
        return Err("wanted resume effect".to_owned());
    };
    let [suspend] = suspended.effects.as_slice() else {
        return Err("wanted suspend effect".to_owned());
    };

    assert!(attached.effects.is_empty());
    assert_eq!(resume.kind, LiveLeaseEffectKind::ResumeWire);
    assert_eq!(suspend.kind, LiveLeaseEffectKind::SuspendWire);
    Ok(())
}

#[test]
fn window_evidence_stays_generation_guarded() {
    let runtime = runtime("tab-a");
    let stale = reduce_feed_runtime_window(runtime, events(1, 9));
    let current = reduce_feed_runtime_window(stale, events(1, 11));

    assert!(current.window.sorted_ids.contains(&id(1)));
    assert_eq!(current.window.generation, 11);
}

fn runtime(id: &str) -> lkjstr_app::FeedRuntimeState {
    start_feed_runtime(FeedRuntimeInput {
        runtime_id: id.to_owned(),
        generation: 11,
        max_items: 30,
    })
}

fn events(value: u64, generation: u64) -> FeedWindowEvidence {
    FeedWindowEvidence::Events {
        generation,
        events: vec![progressive(value)],
        flags: FeedWindowFlags::default(),
    }
}

fn input(owner: &str, visibility: DemandVisibility) -> QueryDemandInput {
    QueryDemandInput {
        surface: QuerySurface::Home,
        owner: owner.to_owned(),
        channel: Some("notes".to_owned()),
        visibility,
        phase: DemandPhase::Live,
        selected_relays: vec!["https://selected.example".to_owned()],
        authors: vec![pubkey("a")],
        author_routes: Vec::<AuthorRelayRoute>::new(),
        disabled_relays: Vec::new(),
        filters: vec![NostrFilter {
            authors: Some(vec![pubkey("a")]),
            kinds: Some(vec![KIND_TEXT_NOTE]),
            limit: Some(30),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::Feed,
        since: Some(now_sec()),
        until: None,
        limit: None,
        now_sec: now_sec(),
    }
}

fn progressive(value: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example/".to_owned()],
        sub_id: "sub-a".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("a"),
            created_at: now_sec() + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("event {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

const fn now_sec() -> u64 {
    1_700_000_030
}

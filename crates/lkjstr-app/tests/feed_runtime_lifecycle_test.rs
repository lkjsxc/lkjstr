use lkjstr_app::{
    FeedRuntimeInput, FeedWindowEvidence, FeedWindowFlags, QueryDemandInput, QuerySurface,
    attach_feed_runtime_live, reduce_feed_runtime_window, release_feed_runtime_live,
    start_feed_runtime,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent, NostrFilter};
use lkjstr_relays::{
    AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility, LiveLeaseEffectKind,
    LiveLeaseState, ProgressiveEvent,
};

#[test]
fn release_removes_live_demand_and_keeps_window() -> Result<(), String> {
    let attached = attach_feed_runtime_live(runtime("tab-a"), LiveLeaseState::new(), input());
    let with_row = reduce_feed_runtime_window(attached.runtime, events(2));
    let released = release_feed_runtime_live(with_row, attached.leases);
    let [close] = released.effects.as_slice() else {
        return Err("wanted close effect".to_owned());
    };

    assert_eq!(close.kind, LiveLeaseEffectKind::CloseWire);
    assert_eq!(released.leases.counts().active_demands, 0);
    assert!(released.runtime.live_fingerprint.is_none());
    assert!(released.runtime.window.sorted_ids.contains(&id(2)));

    let reattached = attach_feed_runtime_live(released.runtime, released.leases, input());
    let [open] = reattached.effects.as_slice() else {
        return Err("wanted reattach open effect".to_owned());
    };

    assert_eq!(open.kind, LiveLeaseEffectKind::OpenWire);
    assert!(reattached.runtime.window.sorted_ids.contains(&id(2)));
    Ok(())
}

#[test]
fn release_closes_live_demand_for_each_feed_surface() -> Result<(), String> {
    for surface in [
        QuerySurface::Home,
        QuerySurface::Global,
        QuerySurface::Profile,
        QuerySurface::UserTimeline,
        QuerySurface::Thread,
        QuerySurface::Notifications,
        QuerySurface::Search,
        QuerySurface::CustomRequest,
        QuerySurface::AuthorContext,
        QuerySurface::PublicChat,
    ] {
        let attached = attach_feed_runtime_live(
            runtime(&format!("{surface:?}")),
            LiveLeaseState::new(),
            input_for(surface),
        );
        let released = release_feed_runtime_live(attached.runtime, attached.leases);
        let [close] = released.effects.as_slice() else {
            return Err(format!("wanted close effect for {surface:?}"));
        };

        assert_eq!(close.kind, LiveLeaseEffectKind::CloseWire);
        assert_eq!(released.leases.counts().active_demands, 0);
        assert_eq!(released.leases.counts().open_live_leases, 0);
    }
    Ok(())
}

fn runtime(id: &str) -> lkjstr_app::FeedRuntimeState {
    start_feed_runtime(FeedRuntimeInput {
        runtime_id: id.to_owned(),
        generation: 11,
        max_items: 30,
    })
}

fn input() -> QueryDemandInput {
    input_for(QuerySurface::Home)
}

fn input_for(surface: QuerySurface) -> QueryDemandInput {
    QueryDemandInput {
        surface,
        owner: "stale-owner".to_owned(),
        channel: Some("notes".to_owned()),
        visibility: DemandVisibility::Visible,
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

fn events(value: u64) -> FeedWindowEvidence {
    FeedWindowEvidence::Events {
        generation: 11,
        events: vec![ProgressiveEvent {
            relays: vec!["wss://selected.example/".to_owned()],
            sub_id: "sub-a".to_owned(),
            event: event(value),
        }],
        flags: FeedWindowFlags::default(),
    }
}

fn event(value: u64) -> NostrEvent {
    NostrEvent {
        id: id(value),
        pubkey: pubkey("a"),
        created_at: now_sec() + value,
        kind: KIND_TEXT_NOTE,
        tags: Vec::new(),
        content: format!("event {value}"),
        sig: "b".repeat(128),
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

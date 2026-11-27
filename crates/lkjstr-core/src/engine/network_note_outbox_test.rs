use super::*;
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

const RELAY: &str = "wss://loopback.test/";
const OTHER: &str = "wss://second.test/";
const KEY: &str = "f357a321-11f1-4f81-8ba1-ed44295a04b3";

fn note() -> Result<NostrEvent, &'static str> {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            content: "a pending signed note".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .map_err(|_| "sign fixture note")
}

fn route(url: &str) -> Destination {
    Destination {
        url: url.into(),
        rule: "own".into(),
        state: "pending".into(),
        reason: None,
    }
}

fn attempts(network: &mut Network) -> Result<Vec<Value>, serde_json::Error> {
    let mut events = vec![];
    for effect in network.drain_effects() {
        if let Effect::Send(_, frame) = effect {
            let frame: Value = serde_json::from_str(&frame)?;
            if frame[0] == "EVENT" {
                events.push(frame[1].clone());
            }
        }
    }
    Ok(events)
}

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[test]
fn reload_retries_only_the_checkpointed_signed_event_and_stops_after_ok() -> TestResult {
    let mut network = Network::default();
    network.note_outbox.enabled = true;
    let event = note()?;
    let routes = vec![route(RELAY)];
    network
        .note_outbox
        .stage(&event, Some(KEY.into()), &routes, 0);
    network.stage_publication(
        "first".into(),
        event.clone(),
        routes,
        0,
        event.pubkey.clone(),
    );
    network.tick(1);
    network.connected(RELAY, 2);
    assert!(attempts(&mut network)?.is_empty());

    let checkpoint = network.note_outbox.snapshot().ok_or("missing checkpoint")?;
    network.note_outbox.committed(checkpoint.revision);
    network.tick(3);
    let frame = serde_json::to_value(&event)?;
    assert_eq!(
        attempts(&mut network)?.as_slice(),
        std::slice::from_ref(&frame)
    );
    network.tick(6_000);
    assert!(
        attempts(&mut network)?.is_empty(),
        "one frame per socket per round"
    );
    network.tick(8_010);
    assert!(network.note_outbox.pending(&event.id));
    assert!(network.note_outbox.due(9_000).is_empty());
    assert_eq!(network.note_outbox.due(11_000)[0].id, event.id);

    let mut replay = Network::default();
    replay.note_outbox.enabled = true;
    assert!(
        replay
            .note_outbox
            .restore(&event.pubkey, &checkpoint.rows[0].1)
    );
    let restored = replay.note_outbox.due(1)[0].clone();
    let routes = replay
        .note_outbox
        .retry_routes(&event.id, vec![], &BTreeSet::new());
    assert_eq!(routes[0].url, RELAY);
    replay.stage_publication("replay".into(), restored, routes, 1, event.pubkey.clone());
    replay.tick(1);
    replay.connected(RELAY, 2);
    assert_eq!(attempts(&mut replay)?, [frame]);
    replay.answer_delivery(&event.id, RELAY, true, "duplicate: stored", 3);
    replay.note_outbox.ready(None, 100_000);
    assert!(replay.note_outbox.due(100_000).is_empty());
    let status = &replay.note_outbox.statuses(&[KEY.into()])[0];
    assert!(status.phase == Phase::Sent);
    assert_eq!(status.attempts, 2);
    Ok(())
}

#[test]
fn a_blocked_relay_leaves_other_routes_live_and_invalid_or_discard_end_the_note() -> TestResult {
    let mut queue = NoteOutbox {
        enabled: true,
        ..Default::default()
    };
    let event = note()?;
    queue.stage(&event, Some(KEY.into()), &[route(RELAY), route(OTHER)], 0);
    let refuse = |url: &str, reason: &str| Delivery {
        relay: url.into(),
        state: "rejected".into(),
        message: Some(reason.into()),
    };
    let blocked = refuse(RELAY, "blocked: local rule");
    let unanswered = Delivery {
        relay: OTHER.into(),
        state: "timeout".into(),
        message: None,
    };
    queue.finished(
        &event.id,
        std::slice::from_ref(&blocked),
        &[blocked.clone(), unanswered],
        1,
    );
    assert!(queue.pending(&event.id));
    queue.ready(Some(RELAY), 2);
    assert!(queue.due(2).is_empty());
    queue.ready(Some(OTHER), 2);
    assert_eq!(queue.due(2)[0].id, event.id);
    let routes = queue.retry_routes(
        &event.id,
        vec![route(RELAY), route(OTHER)],
        &BTreeSet::new(),
    );
    assert_eq!(
        routes
            .iter()
            .map(|route| route.url.as_str())
            .collect::<Vec<_>>(),
        [OTHER]
    );
    let invalid = [refuse(OTHER, "invalid: local rule")];
    queue.finished(&event.id, &invalid, &invalid, 3);
    assert!(queue.statuses(&[KEY.into()])[0].phase == Phase::Refused);

    let other = note()?;
    queue.stage(&other, Some(KEY.into()), &[route(RELAY)], 4);
    assert_eq!(queue.discard(KEY, 5).as_deref(), Some(other.id.as_str()));
    let checkpoint = queue.snapshot().ok_or("missing checkpoint")?;
    queue.committed(checkpoint.revision);
    assert!(
        queue
            .statuses(&[KEY.into()])
            .iter()
            .any(|status| status.phase == Phase::Discarded)
    );
    assert!(queue.due(u64::MAX).is_empty());
    assert_eq!(
        delay(&event.id, u32::MAX).min(60_000),
        delay(&event.id, u32::MAX)
    );
    Ok(())
}

#[test]
fn concurrent_checkpoints_merge_distinct_notes_and_never_resurrect_an_accepted_body() -> TestResult
{
    let signer = generate_secret_key();
    let signed = |text: &str| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: 1,
                kind: 1,
                content: text.into(),
                tags: vec![],
            },
            &signer,
        )
        .map_err(|_| "sign overlap fixture")
    };
    let first = signed("first")?;
    let other = signed("other")?;
    let mut writer = NoteOutbox {
        enabled: true,
        ..Default::default()
    };
    let mut overlap = NoteOutbox {
        enabled: true,
        ..Default::default()
    };
    writer.stage(&first, None, &[route(RELAY)], 1);
    overlap.stage(&other, None, &[route(RELAY)], 1);
    let patch = writer.snapshot().ok_or("missing checkpoint")?;
    writer.committed(patch.revision);
    let raw = merge(None, &patch.rows[0].1).ok_or("merge first note")?.raw;
    let merged = merge(
        Some(&raw),
        &overlap.snapshot().ok_or("missing checkpoint")?.rows[0].1,
    )
    .ok_or("merge overlapping note")?
    .raw;
    writer.accepted(
        &first.id,
        &[Delivery {
            relay: RELAY.into(),
            state: "accepted".into(),
            message: None,
        }],
        2,
    );
    let accepted = merge(
        Some(&merged),
        &writer.snapshot().ok_or("missing checkpoint")?.rows[0].1,
    )
    .ok_or("merge acceptance")?
    .raw;
    let stale = merge(Some(&accepted), &patch.rows[0].1).ok_or("merge stale writer")?;
    assert!(
        stale
            .settled
            .iter()
            .any(|status| status.id == first.id && status.phase == Phase::Sent)
    );
    let mut readback = NoteOutbox {
        enabled: true,
        ..Default::default()
    };
    assert!(readback.restore(&first.pubkey, &stale.raw));
    assert!(!readback.pending(&first.id));
    assert!(readback.pending(&other.id));
    Ok(())
}

#![allow(clippy::expect_used)]
use super::*;
use std::time::Instant;

#[test]
fn ring_totals_survive_eviction_and_keys_are_local() {
    let observer = Observer::default();
    let other = Observer::default();
    let raw = "secret-key-and-tag";
    assert_ne!(observer.key(raw), other.key(raw));
    for i in 0..MAX_RECORDS + 19 {
        let mut r = observer
            .draft(
                ResourceClass::Notes,
                Scope::Resource,
                raw,
                Some("wss://relay.test/private?tag=secret#x"),
                i as u64,
            )
            .expect("record");
        r.wire_bytes = WireBytes::Measured(13);
        r.link_ms = Some(7);
        observer.record(r);
    }
    observer.inspect(|l| {
        assert_eq!(l.records().count(), MAX_RECORDS);
        assert_eq!(l.records().next().expect("oldest").end_ms, 19);
        assert_eq!(l.dropped_records, 19);
        let total = &l.totals[&ResourceClass::Notes];
        assert_eq!(total.measured_bytes, (MAX_RECORDS as u64 + 19) * 13);
        assert_eq!(total.link_ms, (MAX_RECORDS as u64 + 19) * 7);
        let json = serde_json::to_string(l).expect("serialize");
        assert!(!json.contains(raw) && !json.contains("private?") && !json.contains("secret"));
        assert_eq!(
            l.records().next().expect("record").origin(),
            Some("wss://relay.test")
        );
    });
}

#[test]
fn decision_is_opt_in_and_bounded() {
    let observer = Observer::default();
    let candidates = ["first", "second"];
    let log = || {
        observer.decision(
            Action::Fetch,
            10,
            candidates.iter().map(|s| (*s, Some(3))),
            ["second"],
        )
    };
    log();
    assert_eq!(observer.inspect(|l| l.decisions().count()), 0);
    observer.set_decisions(true);
    for _ in 0..MAX_DECISIONS + 2 {
        log();
    }
    observer.inspect(|l| {
        assert_eq!(l.dropped_decisions, 2);
        assert_eq!(l.decisions().count(), MAX_DECISIONS);
        let d = l.decisions().next().expect("decision");
        assert_eq!(d.candidates[1].key, d.chosen[0]);
    });
    observer.decision(
        Action::Keep,
        11,
        std::iter::repeat_n(("x", None), MAX_CANDIDATES + 3),
        ["x"],
    );
    observer.inspect(|l| {
        let d = l.decisions().last().expect("decision");
        assert_eq!(d.candidates.len(), MAX_CANDIDATES);
        assert_eq!(d.omitted, 3);
    });
}

#[test]
fn native_image_is_not_a_measured_network_transfer() {
    let observer = Observer::default();
    let input = serde_json::json!({"class":"media","slot":"note-image","lane":"L1","url":"https://image.test/secret?token=abc","view":"private-view-id","startMs":12,"endMs":20,"displaySize":[100,200],"outcome":"ok"});
    observer.plain_image(serde_json::from_value(input).expect("image"));
    observer.inspect(|l| {
        let r = l.records().next().expect("image");
        assert_eq!(r.class, ResourceClass::Media);
        assert_eq!(r.scope, Scope::Resource);
        assert_eq!(r.lane, Lane::L1);
        assert_eq!(r.source, Source::NetworkOrHttpCache);
        assert_eq!(r.wire_bytes, WireBytes::Unmeasured);
        assert_eq!(r.connection, Connection::Unknown);
        assert_eq!(r.start_ms, Some(12));
        assert_eq!(r.end_ms, 20);
        assert_eq!(r.display_size, Some((100, 200)));
        assert!(r.view.is_some() && r.slot.is_some());
        assert_eq!(r.first_byte_ms, None);
        assert_eq!(r.first_visible_ms, None);
        assert_eq!(r.stored_bytes, None);
        assert_eq!(r.link_ms, None);
        assert_eq!(r.outcome, Outcome::Ok);
        let json = serde_json::to_string(l).expect("serialize");
        assert!(
            !json.contains("token")
                && !json.contains("private-view-id")
                && !json.contains("secret")
        );
    });
}

#[test]
fn record_cost_native() {
    let observer = Observer::default();
    let n = 50_000;
    let start = Instant::now();
    for i in 0..n {
        let mut record = observer
            .draft(
                ResourceClass::Profiles,
                Scope::Resource,
                "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
                Some("wss://relay.example.com/"),
                i,
            )
            .expect("record");
        record.wire_bytes = WireBytes::Measured(512);
        observer.record(record);
    }
    eprintln!(
        "R0 native debug draft+append (including origin and key hash): {:.3} us/record",
        start.elapsed().as_secs_f64() * 1e6 / n as f64
    );
    assert_eq!(
        observer.inspect(|l| l.dropped_records),
        n - MAX_RECORDS as u64
    );
}

#[test]
fn avatar_schedule_observation_does_not_change_commands() {
    use crate::engine::avatars::jobs::{Book, Owner};
    let mut baseline = Book::default();
    let mut observed = Book::default();
    observed.fetches.set_decisions(true);
    for i in 0..6 {
        let owner = Owner {
            client: 1,
            request: format!("face-{i}"),
        };
        let url = format!("https://image.test/{i}");
        assert_eq!(
            baseline.want_observed(owner.clone(), &url, 20, true),
            observed.want_observed(owner, &url, 20, true)
        );
    }
    assert_eq!(baseline.pump(21), observed.pump(21));
    assert_eq!(baseline.counts(), observed.counts());
    assert_eq!(baseline.fetches.inspect(|l| l.decisions().count()), 0);
    observed.fetches.inspect(|l| {
        assert!(
            l.decisions()
                .any(|d| d.action == Action::Fetch && !d.chosen.is_empty())
        )
    });
}

#[test]
fn avatar_ghost_is_consumed_once_and_history_is_bounded() {
    let o = Observer::default();
    for i in 0..=MAX_RECORDS {
        o.evicted(
            ResourceClass::Avatars,
            o.key(&format!("url-{i}")).expect("hash"),
        );
    }
    o.refetched(ResourceClass::Avatars, "url-0");
    for _ in 0..2 {
        o.refetched(ResourceClass::Avatars, "url-1");
    }
    assert_eq!(
        o.inspect(|l| l.totals[&ResourceClass::Avatars].ghost_hits),
        1
    );
}

#[test]
fn fetch_records_json_preserves_all_key_bits_and_joins() {
    let observer = Observer::default();
    observer.set_decisions(true);
    let mut record = observer
        .draft(ResourceClass::Avatars, Scope::Resource, "face", None, 1)
        .expect("record");
    record.key = KeyHash(0xfedc_ba98_7654_3210);
    record.view = Some(KeyHash(0xffff_ffff_ffff_ffff));
    record.slot = Some(KeyHash(0xa));
    observer.record(record);
    let join = observer
        .draft(ResourceClass::Avatars, Scope::Resource, "chosen", None, 2)
        .expect("record");
    let join_hex = format!("{:016x}", join.key.0);
    observer.record(join);
    observer.decision(Action::Keep, 2, [("chosen", Some(1))], ["chosen"]);

    let json: serde_json::Value =
        serde_json::from_str(&observer.fetch_records_json().expect("snapshot")).expect("JSON");
    assert_eq!(json["records"][0][1]["key"], "fedcba9876543210");
    assert_eq!(json["records"][0][1]["view"], "ffffffffffffffff");
    assert_eq!(json["records"][0][1]["slot"], "000000000000000a");
    assert_eq!(json["records"][1][1]["key"], join_hex);
    assert_eq!(json["decisions"][0]["candidates"][0]["key"], join_hex);
    assert_eq!(json["decisions"][0]["chosen"][0], join_hex);
}

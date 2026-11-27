use super::their_home::{Fixture, key};
use super::*;
use lkjstr_core::cache::Record;

fn updates(messages: &[Value], sub: &str) -> Vec<Value> {
    messages
        .iter()
        .filter(|out| out["t"] == "patch" && out["sub"] == sub)
        .flat_map(|out| out["ops"].as_array().expect("patch ops"))
        .filter_map(|op| op.get("row").cloned())
        .collect()
}

#[test]
fn live_replacement_and_timestamp_ties_use_only_the_latest_public_list() {
    let mut f = Fixture::new();
    f.open("their", "their-home", Some(f.owner.clone()));
    f.open("own", "home", None);
    f.open("other", "their-home", Some(f.other.clone()));
    let empty = sign(&key(1), 35, 10000, "still encrypted", &[]);
    ingest(&mut f.engine, 41_000, &[&empty]);
    let out = output(&mut f.session, &mut f.engine);
    let changed = updates(&out, "their");
    for note in &f.notes[..4] {
        assert!(row(&changed, note)["hidden"].is_null());
    }
    assert!(updates(&out, "own").is_empty());
    assert!(updates(&out, "other").is_empty());
    ingest(&mut f.engine, 42_000, &[&f.mute]);
    assert_eq!(
        f.engine
            .store
            .replaceable(&f.owner, 10000)
            .expect("latest")
            .id,
        empty.id
    );
    let ties = [
        sign(&key(1), 36, 10000, "A", &[&["p", &f.notes[0].pubkey]]),
        sign(&key(1), 36, 10000, "B", &[&["word", "ordinary"]]),
    ];
    let (winner, loser) = if ties[0].id < ties[1].id {
        (&ties[0], &ties[1])
    } else {
        (&ties[1], &ties[0])
    };
    for events in [[loser, winner], [winner, loser]] {
        ingest(&mut f.engine, 43_000, &events);
        assert_eq!(
            f.engine
                .store
                .replaceable(&f.owner, 10000)
                .expect("tie winner")
                .id,
            winner.id
        );
    }
    let rows = f.open("their", "their-home", Some(f.owner.clone()));
    let selected = if winner.tags[0][0] == "p" { 0 } else { 4 };
    assert!(
        row(&rows, &f.notes[selected])["hidden"]["reason"]
            .as_str()
            .expect("reason")
            .starts_with("their-muted-")
    );
}

#[test]
fn reveal_is_per_subscription_and_scope_changes_do_not_reuse_the_old_reason() {
    let mut f = Fixture::new();
    f.open("one", "their-home", Some(f.owner.clone()));
    f.open("two", "their-home", Some(f.owner.clone()));
    let id = &f.notes[0].id;
    let revealed = action(&mut f.session, &f.engine, "one", id, true);
    let first = updates(&revealed, "one");
    assert_eq!(
        row(&first, &f.notes[0])["revealed"]["reason"],
        "their-muted-person"
    );
    assert!(
        !row(&first, &f.notes[0])["segments"]
            .as_array()
            .expect("body")
            .is_empty()
    );
    assert!(updates(&revealed, "two").is_empty());
    let hidden = action(&mut f.session, &f.engine, "one", id, false);
    assert_eq!(
        row(&updates(&hidden, "one"), &f.notes[0])["hidden"]["reason"],
        "their-muted-person"
    );
    action(&mut f.session, &f.engine, "one", id, true);
    let own = sign(&key(2), 35, 10000, "", &[&["p", &f.notes[0].pubkey]]);
    ingest(&mut f.engine, 42_000, &[&own]);
    let out = output(&mut f.session, &mut f.engine);
    let changed = updates(&out, "one");
    assert_eq!(
        row(&changed, &f.notes[0])["hidden"]["reason"],
        "muted-person"
    );
    assert!(row(&changed, &f.notes[0])["revealed"].is_null());
}

#[test]
fn ordinary_and_moment_windows_share_scoped_mutes_without_changing_other_home() {
    let mut f = Fixture::new();
    f.open("moment", "their-home", Some(f.owner.clone()));
    accept(
        &mut f.session,
        &mut f.engine,
        json!({"t":"window","sub":"moment",
        "anchor":{"at":24_000},"before":20,"after":20}),
        40_000,
    );
    let messages = output(&mut f.session, &mut f.engine);
    let snapshot = messages
        .iter()
        .find(|m| m["t"] == "rows" && m["sub"] == "moment")
        .expect("moment");
    let rows = snapshot["rows"].as_array().expect("rows");
    for note in &f.notes[..4] {
        assert!(
            row(rows, note)["hidden"]["reason"]
                .as_str()
                .expect("reason")
                .starts_with("their-muted-")
        );
    }
    let own = f.open("own", "home", None);
    for note in &f.notes[..4] {
        assert!(row(&own, note)["hidden"].is_null());
    }
}

#[test]
fn retained_public_policy_survives_cache_restore_without_target_private_mutes() {
    let mut f = Fixture::new();
    f.open("their", "their-home", Some(f.owner.clone()));
    let (access, mut records) = f.engine.cache_metadata_observation(40_000);
    assert!(access.pinned.contains(&f.mute.id));
    assert!(records.iter().any(|record| record.id == f.mute.id));
    records.extend(
        f.notes
            .iter()
            .map(|note| Record::verified(note).expect("record")),
    );
    let mut restored = Engine::new();
    restored.restore_cache(&records);
    let mut session = Session::default();
    let rows = open(
        &mut restored,
        &mut session,
        "their",
        json!({"source":"their-home","pubkey":f.owner}),
        40_000,
    );
    assert_eq!(
        row(&rows, &f.notes[0])["hidden"]["reason"],
        "their-muted-person"
    );
    assert!(row(&rows, &f.notes[7])["hidden"].is_null());
}

#[test]
fn visible_engine_fetches_both_target_lists_even_when_they_are_cached() {
    use lkjstr_core::engine::{network::Effect, protocol::Input};
    let mut f = Fixture::new();
    let relay = "wss://their-home-fixture.test/";
    f.engine.input(
        Input::Configure {
            relays: vec![relay.into()],
        },
        40_000,
    );
    f.engine.network.relay_information(relay, "{}");
    f.open("their", "their-home", Some(f.owner.clone()));
    f.engine.network.connected(relay, 40_001);
    let mut fetched = std::collections::BTreeSet::new();
    for now in (40_100..=43_000).step_by(100) {
        f.engine.tick(now);
        for effect in f.engine.network.drain_effects() {
            let Effect::Send(_, text) = effect else {
                continue;
            };
            let frame: Value = serde_json::from_str(&text).expect("frame");
            if frame[0] != "REQ" {
                continue;
            }
            if frame[2]["authors"] == json!([f.owner]) {
                for kind in [3, 10000] {
                    if frame[2]["kinds"] == json!([kind]) {
                        assert_eq!(frame[2]["limit"], 1);
                        fetched.insert(kind);
                    }
                }
            }
            f.engine
                .network
                .message(relay, &json!(["EOSE", frame[1]]).to_string(), now);
        }
    }
    assert_eq!(fetched, std::collections::BTreeSet::from([3, 10000]));
}

#[test]
fn reply_totals_keep_the_viewers_policy_while_target_mutes_cover_reply_content() {
    let mut f = Fixture::new();
    let root = sign(&key(15), 31, 1, "reply count root", &[]);
    let reply = sign(&key(11), 32, 1, "reply", &[&["e", &root.id, "", "reply"]]);
    ingest(&mut f.engine, 40_000, &[&root, &reply]);
    let own = f.open("own", "home", None);
    let their = f.open("their", "their-home", Some(f.owner.clone()));
    assert_eq!(row(&own, &root)["counts"]["replies"], 1);
    assert_eq!(row(&their, &root)["counts"]["replies"], 1);
    assert_eq!(
        row(&their, &reply)["hidden"]["reason"],
        "their-muted-person"
    );
    let empty = sign(&key(1), 35, 10000, "", &[]);
    ingest(&mut f.engine, 41_000, &[&empty]);
    let rows = f.open("their", "their-home", Some(f.owner.clone()));
    assert_eq!(row(&rows, &root)["counts"]["replies"], 1);
    assert!(row(&rows, &reply)["hidden"].is_null());
}

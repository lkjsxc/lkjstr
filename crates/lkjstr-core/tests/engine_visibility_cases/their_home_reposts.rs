use super::their_home::{Fixture, key};
use super::*;

#[test]
fn muted_reposts_keep_their_own_slot_without_hiding_independent_original_admissions() {
    for admission in ["none", "repost", "direct"] {
        for notifications in [false, true] {
            let mut f = Fixture::new();
            let original = sign(&key(20), 10, 1, "unmuted original", &[]);
            let muted = sign(&key(11), 32, 6, "", &[&["e", &original.id]]);
            let allowed = sign(&key(15), 31, 6, "", &[&["e", &original.id]]);
            ingest(&mut f.engine, 40_000, &[&original, &muted]);
            if admission == "repost" {
                ingest(&mut f.engine, 40_000, &[&allowed]);
            }
            if admission == "direct" {
                let follows = sign(
                    &key(1),
                    35,
                    3,
                    "",
                    &[&["p", &muted.pubkey], &["p", &original.pubkey]],
                );
                ingest(&mut f.engine, 40_000, &[&follows]);
            }
            let rows = open(
                &mut f.engine,
                &mut f.session,
                "their",
                json!({
                    "source":"their-home", "pubkey":f.owner, "account":f.viewer,
                    "notifications":notifications,
                }),
                40_000,
            );
            let hidden = row(&rows, &muted);
            assert_eq!(hidden["hidden"]["reason"], "their-muted-person");
            assert_eq!(hidden["at"], 32_000);
            assert_eq!(hidden["segments"], json!([]));
            assert_eq!(
                rows.iter().any(|row| row["id"] == original.id),
                admission != "none"
            );
            if admission != "none" {
                let visible = row(&rows, &original);
                assert!(visible["hidden"].is_null());
                assert!(
                    !visible["repostedBy"]["actors"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .any(|actor| actor["pubkey"] == muted.pubkey)
                );
            }
            let own = f.open("own", "home", None);
            assert!(row(&own, &original)["hidden"].is_null());
            assert!(!own.iter().any(|row| row["id"] == muted.id));
        }
    }
}

#[test]
fn muted_repost_moment_time_rail_and_reveal_use_the_same_signed_slot() {
    let mut f = Fixture::new();
    let original = sign(&key(20), 10, 1, "original", &[]);
    let muted = sign(&key(11), 32, 6, "", &[&["e", &original.id]]);
    let allowed = sign(&key(15), 31, 6, "", &[&["e", &original.id]]);
    ingest(&mut f.engine, 40_000, &[&original, &muted, &allowed]);
    let initial = f.open("their", "their-home", Some(f.owner.clone()));
    f.engine.cached_history_complete = true;
    let mut timeline = None;
    for now in [40_000, 40_200, 40_400, 40_600] {
        for message in f.session.timeline_tick(&f.engine, now) {
            let value = serde_json::to_value(message).expect("timeline wire");
            if value["t"] == "timeline" && value["timeline"]["supported"] == true {
                timeline = Some(value["timeline"].clone());
            }
        }
    }
    let timeline = timeline.expect("supported rail");
    let count: u64 = timeline["months"]
        .as_array()
        .expect("months")
        .iter()
        .map(|month| month["count"].as_u64().expect("count"))
        .sum();
    assert_eq!(count, initial.len() as u64);
    accept(
        &mut f.session,
        &mut f.engine,
        json!({"t":"window","sub":"their",
        "anchor":{"at":31_000},"before":20,"after":20}),
        40_700,
    );
    let out = output(&mut f.session, &mut f.engine);
    let moment = out.iter().find(|out| out["t"] == "rows").expect("moment")["rows"]
        .as_array()
        .expect("rows");
    assert_eq!(row(moment, &muted)["readingAt"], 32_000);
    assert_eq!(row(moment, &original)["readingAt"], 31_000);
    let revealed = action(&mut f.session, &f.engine, "their", &muted.id, true);
    let changed = &revealed
        .iter()
        .find(|out| out["t"] == "patch")
        .expect("reveal")["ops"][0]["row"];
    assert_eq!(changed["id"], muted.id);
    assert_eq!(changed["readingAt"], 32_000);
    assert_eq!(changed["revealed"]["reason"], "their-muted-person");
    assert_eq!(changed["quotes"][0]["id"], original.id);
    assert_eq!(changed["quotes"][0]["state"], "ok");
}

#[test]
fn event_muted_repost_and_own_action_state_remain_independent() {
    let mut f = Fixture::new();
    let original = sign(&key(20), 10, 1, "original", &[]);
    let own = sign(&key(2), 32, 6, "", &[&["e", &original.id]]);
    let allowed = sign(&key(15), 31, 6, "", &[&["e", &original.id]]);
    let follows = sign(
        &key(1),
        33,
        3,
        "",
        &[&["p", &own.pubkey], &["p", &allowed.pubkey]],
    );
    let mute = sign(&key(1), 34, 10000, "", &[&["e", &own.id]]);
    ingest(
        &mut f.engine,
        40_000,
        &[&original, &own, &allowed, &follows, &mute],
    );
    let rows = f.open("their", "their-home", Some(f.owner.clone()));
    assert_eq!(row(&rows, &own)["hidden"]["reason"], "their-muted-thread");
    assert_eq!(row(&rows, &original)["mine"]["reposted"], true);
    assert_eq!(
        row(&rows, &original)["repostedBy"]["actors"][0]["pubkey"],
        allowed.pubkey
    );
}

#[test]
fn public_mutes_do_not_admit_excluded_channel_reposts() {
    let mut f = Fixture::new();
    let channel = sign(
        &key(20),
        10,
        42,
        "channel message",
        &[&["e", &"a".repeat(64), "", "root"]],
    );
    let repost = sign(&key(11), 32, 6, "", &[&["e", &channel.id]]);
    ingest(&mut f.engine, 40_000, &[&channel, &repost]);
    let rows = f.open("their", "their-home", Some(f.owner.clone()));
    assert!(
        !rows
            .iter()
            .any(|row| row["id"] == channel.id || row["id"] == repost.id)
    );
}

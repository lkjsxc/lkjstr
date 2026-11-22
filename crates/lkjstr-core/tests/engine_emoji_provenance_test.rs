#![allow(clippy::expect_used)]
mod engine_review_support;
#[path = "cache_context/support.rs"]
mod fixture;
#[path = "engine_emoji_support/provenance.rs"]
mod provenance;
use engine_review_support::{accept, output};
use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::generate_secret_key;
use serde_json::{Value, json};

fn project(engine: &mut Engine, query: Value) -> Vec<Value> {
    let mut session = wire::Session::default();
    accept(
        &mut session,
        engine,
        json!({"t":"open","sub":"view","query":query}),
        100_000,
    );
    accept(
        &mut session,
        engine,
        json!({"t":"window","sub":"view","anchor":"top","before":0,"after":400}),
        100_000,
    );
    output(&mut session, engine)
        .into_iter()
        .rev()
        .find(|message| message["t"] == "rows")
        .expect("rows")["rows"]
        .as_array()
        .expect("row array")
        .clone()
}
fn emoji(code: &str, url: &str, address: &str) -> Vec<String> {
    vec!["emoji".into(), code.into(), url.into(), address.into()]
}

#[test]
fn incoming_pictures_and_known_provenance_survive_note_name_bio_and_reaction_projection() {
    let provenance::Fixture {
        mut engine,
        note,
        first,
        second,
        address,
        beta,
    } = provenance::setup();
    let rows = project(
        &mut engine,
        json!({"source":"thread","id":note.id,"account":note.pubkey}),
    );
    let row = rows.iter().find(|row| row["id"] == note.id).expect("note");
    let segments = row["segments"].as_array().expect("segments");
    let own = segments
        .iter()
        .find(|part| part["code"] == "pien")
        .expect("incoming emoji");
    assert_eq!(own["url"], "https://images.test/note.png");
    assert_eq!(own["address"], address);
    assert_eq!(own["set"], "Alpha");
    let bare = segments
        .iter()
        .find(|part| part["code"] == "bare")
        .expect("bare emoji");
    assert!(bare.get("address").is_none() && bare.get("set").is_none());
    let unknown = segments
        .iter()
        .find(|part| part["code"] == "unknown")
        .expect("unknown set");
    assert!(unknown["address"].is_string() && unknown.get("set").is_none());
    assert_eq!(
        row["author"]["emoji"][0]["url"],
        "https://images.test/name.png"
    );
    assert_eq!(row["author"]["emoji"][0]["set"], "Alpha");
    let chips = row["reactions"].as_array().expect("chips");
    assert_eq!(chips.len(), 2);
    for (url, label, coordinate) in [
        ("https://images.test/first.png", "Alpha", address.as_str()),
        ("https://images.test/second.png", "Beta", beta.as_str()),
    ] {
        let chip = chips
            .iter()
            .find(|chip| chip["url"] == url)
            .expect("separate picture chip");
        assert_eq!(chip["emoji"], ":pien:");
        assert_eq!(chip["count"], 1);
        assert_eq!(chip["set"], label);
        assert_eq!(chip["address"], coordinate);
    }
    let profile_rows = project(
        &mut engine,
        json!({"source":"profile","pubkey":note.pubkey}),
    );
    let profile_row = profile_rows
        .iter()
        .find(|row| row["kind"] == "profile")
        .expect("profile");
    assert_eq!(
        profile_row["about"][0]["url"],
        "https://images.test/name.png"
    );
    assert_eq!(profile_row["about"][0]["set"], "Alpha");
    let activity = project(
        &mut engine,
        json!({"source":"profile","pubkey":first.pubkey,"show":"reactions"}),
    );
    assert!(
        activity
            .iter()
            .any(|row| row["act"]["emoji"]["address"] == address
                && row["act"]["emoji"]["set"] == "Alpha")
    );
    let notifications = project(
        &mut engine,
        json!({"source":"notifications","account":note.pubkey}),
    );
    let notice = notifications
        .iter()
        .find(|row| row["type"] == "reaction")
        .expect("reaction notification");
    assert_eq!(notice["emoji"]["url"], "https://images.test/second.png");
    assert_eq!(notice["emoji"]["set"], "Beta");
    assert_eq!(
        notice["key"],
        format!("notification:reaction:{}::pien:", note.id)
    );
    let mark = wire::notification_read_mark(&engine, &note.pubkey);
    assert_eq!(mark.at, 13_000);
    assert!(mark.ties.contains(&second.id));
    engine.seen.insert(note.pubkey.clone(), mark.at);
    engine
        .notification_ties
        .insert(note.pubkey.clone(), mark.ties);
    assert!(
        project(
            &mut engine,
            json!({"source":"notifications","account":note.pubkey})
        )
        .iter()
        .all(|row| row["unread"] == false)
    );
}

#[test]
fn cached_set_title_arrival_changes_only_optional_provenance() {
    let key = generate_secret_key();
    let pack = fixture::event(
        &key,
        30030,
        1,
        "",
        vec![
            vec!["d".into(), "later".into()],
            vec!["title".into(), "Arrived".into()],
            emoji("pien", "https://images.test/event-owned.png", ""),
        ],
    );
    let address = format!("30030:{}:later", pack.pubkey);
    let note = fixture::event(
        &generate_secret_key(),
        1,
        2,
        ":pien:",
        vec![emoji(
            "pien",
            "https://images.test/event-owned.png",
            &address,
        )],
    );
    let mut engine = Engine::new();
    engine.store.insert(note.clone(), None);
    let query = json!({"source":"thread","id":note.id});
    let before = project(&mut engine, query.clone());
    assert!(before[0]["segments"][0].get("set").is_none());
    assert_eq!(before[0]["segments"][0]["address"], address);
    engine.store.insert(pack, None);
    let after = project(&mut engine, query);
    assert_eq!(
        before[0]["segments"][0]["url"],
        after[0]["segments"][0]["url"]
    );
    assert_eq!(after[0]["segments"][0]["set"], "Arrived");
}

#[test]
fn known_set_provenance_requires_picture_membership_but_allows_shortcode_aliases() {
    let provenance::Fixture {
        mut engine,
        address,
        ..
    } = provenance::setup();
    let note = fixture::event(
        &generate_secret_key(),
        1,
        20,
        ":pien_2: :pien:",
        vec![
            emoji("pien_2", "https://images.test/note.png", &address),
            emoji("pien", "https://images.test/unheld.png", &address),
        ],
    );
    engine.store.insert(note.clone(), None);
    let rows = project(&mut engine, json!({"source":"thread","id":note.id}));
    let row = rows.iter().find(|row| row["id"] == note.id).expect("note");
    let segments = row["segments"].as_array().expect("segments");
    let alias = segments
        .iter()
        .find(|part| part["code"] == "pien_2")
        .expect("aliased picture");
    assert_eq!(alias["url"], "https://images.test/note.png");
    assert_eq!(alias["address"], address);
    assert_eq!(alias["set"], "Alpha");
    let unheld = segments
        .iter()
        .find(|part| part["code"] == "pien")
        .expect("claimed picture");
    assert_eq!(unheld["url"], "https://images.test/unheld.png");
    assert_eq!(unheld["address"], address);
    assert!(unheld.get("set").is_none());
}

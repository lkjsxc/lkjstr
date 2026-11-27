use super::*;
use lkjstr_core::engine::{protocol::Query, query};
use lkjstr_protocol::parse_secret_key_hex;

pub(super) fn key(seed: u8) -> SecretKeyBytes {
    parse_secret_key_hex(&format!("{seed:02x}").repeat(32)).expect("fixed fixture key")
}

pub(super) struct Fixture {
    pub engine: Engine,
    pub session: Session,
    pub notes: Vec<NostrEvent>,
    pub owner: String,
    pub viewer: String,
    pub other: String,
    pub mute: NostrEvent,
}

impl Fixture {
    pub fn new() -> Self {
        let notes = [
            (11, "person", vec![]),
            (12, "event", vec![]),
            (13, "tag", vec![vec!["t", "SPOILER"]]),
            (14, "A BLOCKED-word in a sentence", vec![]),
            (15, "ordinary note", vec![]),
            (16, "viewer-owned", vec![]),
            (17, "viewer-private", vec![]),
            (18, "target-private", vec![]),
        ]
        .into_iter()
        .map(|(seed, text, tags)| {
            let tags: Vec<_> = tags.iter().map(Vec::as_slice).collect();
            sign(&key(seed), 10 + u64::from(seed), 1, text, &tags)
        })
        .collect::<Vec<_>>();
        let follows = notes
            .iter()
            .map(|note| vec!["p", note.pubkey.as_str()])
            .collect::<Vec<_>>();
        let tags = follows.iter().map(Vec::as_slice).collect::<Vec<_>>();
        let lists = [1, 2, 3].map(|seed| sign(&key(seed), 5, 3, "", &tags));
        let mute = sign(
            &key(1),
            6,
            10000,
            "opaque encrypted target content",
            &[
                &["p", &notes[0].pubkey],
                &["e", &notes[1].id],
                &["t", "spoiler"],
                &["word", "blocked-WORD"],
            ],
        );
        let own = sign(
            &key(2),
            6,
            10000,
            "opaque encrypted viewer content",
            &[&["word", "viewer-owned"]],
        );
        let mut engine = Engine::new();
        let mut events: Vec<_> = notes.iter().chain(lists.iter()).collect();
        events.extend([&mute, &own]);
        ingest(&mut engine, 40_000, &events);
        engine.private_lists.insert(
            mute.id.clone(),
            vec![vec!["word".into(), "target-private".into()]],
        );
        engine.private_lists.insert(
            own.id.clone(),
            vec![vec!["word".into(), "viewer-private".into()]],
        );
        Self {
            engine,
            session: Session::default(),
            notes,
            owner: lists[0].pubkey.clone(),
            viewer: lists[1].pubkey.clone(),
            other: lists[2].pubkey.clone(),
            mute,
        }
    }

    pub fn open(&mut self, sub: &str, source: &str, owner: Option<String>) -> Vec<Value> {
        open(
            &mut self.engine,
            &mut self.session,
            sub,
            json!({"source":source,"account":self.viewer,"pubkey":owner}),
            40_000,
        )
    }
}

#[test]
fn their_home_public_mutes_are_scoped_and_never_read_another_accounts_private_entries() {
    let mut f = Fixture::new();
    let own_before = f
        .engine
        .store
        .replaceable(&f.viewer, 10000)
        .expect("own list");
    let their = f.open("their", "their-home", Some(f.owner.clone()));
    for (note, expected) in f.notes.iter().zip([
        "their-muted-person",
        "their-muted-thread",
        "their-muted-hashtag",
        "their-muted-word",
    ]) {
        let covered = row(&their, note);
        assert_eq!(covered["hidden"]["reason"], expected);
        assert_eq!(covered["hidden"]["revealable"], true);
        assert_eq!(covered["segments"], json!([]));
        assert_eq!(covered["quotes"], json!([]));
        assert_eq!(covered["media"], json!([]));
    }
    for index in [5, 6] {
        assert_eq!(
            row(&their, &f.notes[index])["hidden"]["reason"],
            "muted-word"
        );
    }
    for index in [4, 7] {
        assert!(row(&their, &f.notes[index])["hidden"].is_null());
    }
    for (source, target) in [("home", None), ("their-home", Some(f.other.clone()))] {
        // Reuse the same subscription: reopening must discard scoped reveal/list state.
        let rows = f.open("their", source, target);
        for note in &f.notes[..5] {
            assert!(row(&rows, note)["hidden"].is_null());
        }
        for index in [5, 6] {
            assert_eq!(
                row(&rows, &f.notes[index])["hidden"]["reason"],
                "muted-word"
            );
        }
        assert!(row(&rows, &f.notes[7])["hidden"].is_null());
    }
    assert_eq!(
        f.engine
            .store
            .replaceable(&f.viewer, 10000)
            .expect("unchanged"),
        own_before
    );
    assert_eq!(
        *f.engine.store.get(&f.mute.id).expect("target list"),
        f.mute
    );
}

#[test]
fn viewer_mutes_win_and_event_mutes_cover_signed_reply_roots() {
    let mut f = Fixture::new();
    let own = sign(
        &key(2),
        9,
        10000,
        "",
        &[&["word", "person"], &["word", "viewer-owned"]],
    );
    ingest(&mut f.engine, 40_000, &[&own]);
    let rows = f.open("their", "their-home", Some(f.owner.clone()));
    assert_eq!(row(&rows, &f.notes[0])["hidden"]["reason"], "muted-word");
    let reply = sign(
        &key(19),
        30,
        1,
        "reply",
        &[
            &["e", &f.notes[1].id, "", "root"],
            &["e", &f.notes[4].id, "", "reply"],
        ],
    );
    let query = Query {
        source: lkjstr_core::engine::protocol::Source::TheirHome,
        account: Some(f.viewer.clone()),
        target: Some(f.owner.clone()),
        ..Default::default()
    };
    assert_eq!(
        query::hidden_with_lists(&f.engine.store, &query, &reply, &f.engine.private_lists)
            .as_deref(),
        Some("their-muted-thread")
    );
}

#[test]
fn target_mutes_cover_nested_quotes_and_reply_excerpts_and_recover_after_unmute() {
    let mut f = Fixture::new();
    let quote = sign(&key(15), 31, 1, "quoting", &[&["q", &f.notes[0].id]]);
    let reply = sign(
        &key(15),
        32,
        1,
        "answer",
        &[&["e", &f.notes[0].id, "", "reply"]],
    );
    ingest(&mut f.engine, 40_000, &[&quote, &reply]);
    let rows = f.open("their", "their-home", Some(f.owner.clone()));
    let nested = &row(&rows, &quote)["quotes"][0];
    assert_eq!(nested["state"], "muted");
    assert_eq!(nested["reason"], "their-muted-person");
    assert!(nested["segments"].is_null());
    assert!(row(&rows, &reply)["replyTo"].is_null());
    let own = f.open("own", "home", None);
    assert_eq!(row(&own, &quote)["quotes"][0]["state"], "ok");
    assert!(!row(&own, &reply)["replyTo"].is_null());
    let empty = sign(&key(1), 35, 10000, "", &[]);
    ingest(&mut f.engine, 41_000, &[&empty]);
    let updates = output(&mut f.session, &mut f.engine);
    let changed = updates
        .iter()
        .filter(|out| out["t"] == "patch" && out["sub"] == "their")
        .flat_map(|out| out["ops"].as_array().expect("ops"))
        .filter_map(|op| op.get("row"))
        .collect::<Vec<_>>();
    assert!(
        changed
            .iter()
            .any(|row| row["id"] == quote.id && row["quotes"][0]["state"] == "ok")
    );
    assert!(
        changed
            .iter()
            .any(|row| row["id"] == reply.id && row["replyTo"]["id"] == f.notes[0].id)
    );
}

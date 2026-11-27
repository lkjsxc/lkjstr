#![allow(clippy::expect_used)]
mod engine_review_support;

use engine_review_support::{accept, output};
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, parse_secret_key_hex};
use serde_json::{Value, json};

fn event(at: u64, kind: u64, content: &str, tags: &[&[&str]]) -> NostrEvent {
    let key = parse_secret_key_hex(&"01".repeat(32)).expect("public test key");
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: content.into(),
            tags: tags
                .iter()
                .map(|t| t.iter().map(|v| (*v).into()).collect())
                .collect(),
        },
        &key,
    )
    .expect("signed fixture")
}

fn rows(engine: &mut Engine, query: Value) -> Vec<Value> {
    let mut session = Session::default();
    accept(
        &mut session,
        engine,
        json!({"t":"open","sub":"golden","query":query}),
        100_000,
    );
    output(&mut session, engine)
        .into_iter()
        .find(|v| v["t"] == "rows" && v["sub"] == "golden")
        .expect("rows frame")["rows"]
        .as_array()
        .expect("rows")
        .clone()
}

fn find(rows: &[Value], event: &NostrEvent) -> Value {
    rows.iter()
        .find(|v| v["id"] == event.id)
        .expect("note row")
        .clone()
}

fn native_rows() -> Value {
    let standard = event(10, 1, "Historical name fixture", &[]);
    let generic = event(
        11,
        30311,
        "Meet at the river after the talk. A public session with a short description.",
        &[
            &["alt", "Afternoon Nostr Meetup"],
            &["title", "Afternoon Nostr Meetup"],
            &["t", "nostr"],
            &[
                "p",
                "e029b24bd46df18a13ac35ce079029b24bdf68f18a13ace57e079029bd46df68",
            ],
            &["url", "https://example.org/meetup"],
            &[
                "custom",
                "A long unknown raw item that is deliberately hidden behind a short ellipsis on narrow screens",
            ],
        ],
    );
    let list = event(
        12,
        30030,
        "Public collection of developer tools",
        &[&["d", "developer-tools"]],
    );
    let covered = event(13, 1, r#"{"machine":true}"#, &[]);
    let mut engine = Engine::new();
    for event in [&standard, &generic, &list, &covered] {
        engine.enqueue("cache".into(), event.clone());
    }
    engine.tick(100_000);
    let profile = rows(
        &mut engine,
        json!({"source":"profile","pubkey":standard.pubkey,"show":"all"}),
    );
    let global = rows(&mut engine, json!({"source":"global"}));
    let hidden = find(&global, &covered);
    assert_eq!(hidden["hidden"]["reason"], "machine-payload");
    json!({
        "standard": find(&profile, &standard),
        "generic": find(&profile, &generic),
        "list": find(&profile, &list),
        "covered": hidden,
    })
}

#[test]
fn native_note_rows_match_golden() {
    let actual = native_rows();
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../web/tests/fixtures/native-note-rows.json"
    );
    // Explicit, opt-in regeneration; ordinary test runs never rewrite the golden.
    // LKJSTR_UPDATE_NOTE_ROW_GOLDEN=1 cargo test -p lkjstr-core --test engine_note_row_golden_test
    if std::env::var_os("LKJSTR_UPDATE_NOTE_ROW_GOLDEN").as_deref()
        == Some(std::ffi::OsStr::new("1"))
    {
        std::fs::write(
            path,
            format!("{}\n", serde_json::to_string_pretty(&actual).expect("JSON")),
        )
        .expect("write golden");
    }
    let expected: Value =
        serde_json::from_str(&std::fs::read_to_string(path).expect("golden file"))
            .expect("golden JSON");
    assert_eq!(
        actual, expected,
        "native NoteRow contract changed; review the golden"
    );
    let mut missing = expected.clone();
    missing["list"]
        .as_object_mut()
        .expect("row")
        .remove("eventKind");
    assert_ne!(actual, missing);
    let mut mutated = expected;
    mutated["covered"]["hidden"]["revealable"] = json!(false);
    assert_ne!(actual, mutated);
}

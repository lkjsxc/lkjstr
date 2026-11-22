#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Output, Patch, Query, Source},
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};

const BASE: u64 = 200_000;
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
const WRITE: &str = "wss://writer.test/";
fn signed(key: &SecretKeyBytes, kind: u64, content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content: content.into(),
            tags,
        },
        key,
    )
    .expect("signed fixture")
}
fn requests(effects: &[Effect]) -> Vec<(String, Value)> {
    effects
        .iter()
        .filter_map(|effect| match effect {
            Effect::Send(url, text) => {
                let frame: Value = serde_json::from_str(text).expect("frame");
                (frame[0] == "REQ").then_some((url.clone(), frame))
            }
            _ => None,
        })
        .collect()
}
fn setup(disabled: bool) -> (Engine, SecretKeyBytes, NostrEvent, Value) {
    let mut e = Engine::new();
    let mut relays = vec![A.into(), B.into()];
    if disabled {
        relays.push(WRITE.into());
    }
    e.input(Input::Configure { relays }, BASE);
    if disabled {
        e.network
            .known
            .get_mut(WRITE)
            .expect("configured writer")
            .read = false;
    }
    let key = generate_secret_key();
    let root = signed(&key, 1, "thread root", vec![]);
    e.input(
        Input::Open {
            sub: "thread".into(),
            query: Query {
                source: Source::Thread,
                target: Some(root.id.clone()),
                ..Default::default()
            },
        },
        BASE,
    );
    e.network.connected(A, BASE + 1);
    e.network.drain_effects();
    e.enqueue(A.into(), root.clone());
    e.tick(BASE + 100);
    e.tick(BASE + 175);
    assert!(
        e.drain().iter().any(|output| match output {
            Output::Rows { items, .. } => items.iter().any(|row| row.id == root.id),
            Output::Patch { ops, .. } => ops
                .iter()
                .any(|op| matches!(op, Patch::Upsert {item,..} if item.id == root.id)),
            _ => false,
        }),
        "verified root is projected before learning its profile route"
    );
    let first = requests(&e.network.drain_effects())
        .into_iter()
        .find(|(url, f)| {
            url == A && f[2]["kinds"] == json!([0]) && f[2]["authors"] == json!([root.pubkey])
        })
        .expect("initial delivering-relay metadata request")
        .1;
    (e, key, root, first)
}
fn discover(e: &mut Engine, key: &SecretKeyBytes, role: &str) -> Vec<Effect> {
    let list = signed(
        key,
        10002,
        "",
        vec![vec!["r".into(), WRITE.into(), role.into()]],
    );
    let author = list.pubkey.clone();
    let id = list.id.clone();
    e.enqueue(A.into(), list);
    e.tick(BASE + 200);
    assert_eq!(
        e.store
            .replaceable(&author, 10002)
            .expect("verified route")
            .id,
        id
    );
    e.network.drain_effects()
}
#[test]
fn visible_thread_metadata_joins_new_verified_writer_without_cancelling_first_route() {
    let (mut e, key, root, first) = setup(false);
    let effects = discover(&mut e, &key, "write");
    assert!(
        effects
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(url) if url == WRITE)),
        "missing profile must acquire its newly verified author write route"
    );
    assert!(
        !effects
            .iter()
            .any(|effect| matches!(effect, Effect::Send(url, text)
        if url == A && text == &json!(["CLOSE", first[1]]).to_string())),
        "adding a writer must preserve the already transmitted configured request"
    );
    e.network.connected(WRITE, BASE + 201);
    let early = e.network.drain_effects();
    assert!(
        requests(&early)
            .iter()
            .all(|(url, frame)| url != WRITE || frame[2]["kinds"] != json!([0])),
        "automatic metadata retains its coalescing window after connect"
    );
    e.tick(BASE + 249);
    assert!(
        requests(&e.network.drain_effects())
            .iter()
            .all(|(url, frame)| url != WRITE || frame[2]["kinds"] != json!([0])),
        "automatic metadata cannot bypass the fifty millisecond window"
    );
    e.tick(BASE + 250);
    let effects = e.network.drain_effects();
    assert!(
        requests(&effects).iter().any(|(url, frame)| url == WRITE
            && frame[2]["kinds"] == json!([0])
            && frame[2]["authors"] == json!([root.pubkey])
            && frame[2]["limit"] == 1),
        "writer receives a finite author-specific metadata request"
    );
    e.enqueue(
        WRITE.into(),
        signed(
            &key,
            0,
            r#"{"name":"outbox-only","picture":"https://pictures.test/face.png"}"#,
            vec![],
        ),
    );
    e.tick(BASE + 350);
    let updated = e.drain();
    assert!(
        updated.iter().any(|output| match output {
            Output::Rows { items, .. } => items.iter().any(|row| row.id == root.id
                && row.author.name == "outbox-only"
                && row.author.picture.as_deref() == Some("https://pictures.test/face.png")),
            Output::Patch { ops, .. } => ops.iter().any(|op| matches!(op, Patch::Upsert {item,..}
            if item.id == root.id && item.author.name == "outbox-only"
                && item.author.picture.as_deref() == Some("https://pictures.test/face.png"))),
            _ => false,
        }),
        "the existing thread row gains the writer-only profile"
    );
    let mut effects = e.network.drain_effects();
    e.input(
        Input::Hint {
            focused_sub: None,
            visible_subs: vec![],
            page_hidden: true,
            idle: false,
            save_data: false,
        },
        BASE + 400,
    );
    effects.extend(e.network.drain_effects());
    assert!(
        effects
            .iter()
            .any(|effect| matches!(effect, Effect::Disconnect(url) if url == WRITE))
    );
    assert!(
        !e.network.relays.contains_key(WRITE),
        "hidden owner releases its transient writer"
    );
}
#[test]
fn read_only_advertisement_does_not_supply_author_profile_hydration() {
    let (mut e, key, _, _) = setup(false);
    let effects = discover(&mut e, &key, "read");
    assert!(
        !effects
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(url) if url == WRITE))
    );
    assert!(!e.network.relays.contains_key(WRITE));
}
#[test]
fn verified_writer_cannot_override_explicit_read_disable_for_profile_hydration() {
    let (mut e, key, _, _) = setup(true);
    let effects = discover(&mut e, &key, "write");
    assert!(
        !effects
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(url) if url == WRITE))
    );
    e.tick(BASE + 275);
    assert!(
        requests(&e.network.drain_effects())
            .iter()
            .all(|(url, _)| url != WRITE)
    );
}

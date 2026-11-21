#![allow(clippy::expect_used)]

mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::{ProfilePointer, encode_note, encode_nprofile, encode_npub};
use serde_json::{Value, json};

#[test]
fn draft_paste_expands_only_valid_standalone_profiles_and_retains_hints() {
    let sender = event(1, 1, "sender", vec![]).pubkey;
    let recipient = event(2, 1, "recipient", vec![]).pubkey;
    let hint = "wss://profile-relay.example/";
    let npub = encode_npub(&recipient).expect("npub");
    let nprofile = encode_nprofile(&ProfilePointer {
        pubkey: recipient.clone(),
        relays: Some(vec![hint.into()]),
    })
    .expect("nprofile");
    let invalid = format!("{npub}0");
    let url_only = encode_npub(&sender).expect("unrelated npub");
    let url = format!("https://example.test/({url_only})?profile={npub}");
    let note = encode_note(&"44".repeat(32)).expect("note");
    let untouched = format!("{invalid} {url} {url_only}/path npub1unfinished {note}");
    let text = format!("🌿 ({npub}), \"{nprofile}\". nostr:{nprofile} {untouched}");
    let expected = format!("🌿 (nostr:{npub}), \"nostr:{nprofile}\". nostr:{nprofile} {untouched}");
    let mut session = Session::default();
    let mut engine = Engine::new();
    accept(
        &mut session,
        &mut engine,
        json!({
            "t": "act", "req": "paste", "action": {
                "a": "publish", "as": sender, "what": {"k": "note", "draft": {"text": text}}
            }
        }),
        1000,
    );
    let frames = output(&mut session, &mut engine);
    let sign = frames
        .iter()
        .find(|frame| frame["t"] == "sign")
        .expect("sign");
    let unsigned: Value =
        serde_json::from_str(sign["event"].as_str().expect("event")).expect("JSON");
    assert_eq!(unsigned["content"], expected);
    let recipients: Vec<_> = unsigned["tags"]
        .as_array()
        .expect("tags")
        .iter()
        .filter(|tag| tag[0] == "p")
        .cloned()
        .collect();
    assert_eq!(recipients, [json!(["p", recipient, hint])]);
}

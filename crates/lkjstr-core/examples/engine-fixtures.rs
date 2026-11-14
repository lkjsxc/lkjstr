//! Stateful test signer. Emits public events only; keys never leave this process.
use lkjstr_protocol::{EventTemplate, UnsignedNostrEvent, finalize_event, generate_secret_key};
use serde_json::json;
use std::io::{self, BufRead};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let key = generate_secret_key();
    let sign = |kind, content: String, tags| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: 1700000000,
                kind,
                content,
                tags,
            },
            &key,
        )
        .map_err(|_| "fixture signing failed")
    };
    let note = sign(
        1,
        "Engine fixture 日本語 :cat: https://example.test/cat.png".into(),
        vec![vec![
            "emoji".into(),
            "cat".into(),
            "https://example.test/cat.png".into(),
        ]],
    )?;
    let metadata = sign(
        0,
        json!({"name":"engine-fixture","nip05":"fixture@example.test"}).to_string(),
        vec![],
    )?;
    let follows = sign(
        3,
        String::new(),
        vec![vec!["p".into(), note.pubkey.clone()]],
    )?;
    let mutes = sign(10000, String::new(), vec![])?;
    let bookmarks = sign(10003, String::new(), vec![])?;
    println!(
        "{}",
        json!({"note":note,"events":[metadata,follows,mutes,bookmarks]})
    );
    for line in io::stdin().lock().lines() {
        let line = line?;
        let unsigned: UnsignedNostrEvent = serde_json::from_str(&line)?;
        let signed = finalize_event(
            &EventTemplate {
                pubkey: Some(unsigned.pubkey),
                created_at: unsigned.created_at,
                kind: unsigned.kind,
                content: unsigned.content,
                tags: unsigned.tags,
            },
            &key,
        )
        .map_err(|_| "fixture signing failed")?;
        println!("{}", serde_json::to_string(&signed)?);
    }
    Ok(())
}

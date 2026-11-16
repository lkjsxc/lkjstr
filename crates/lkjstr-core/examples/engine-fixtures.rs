//! Stateful test signer. Emits public events only; keys never leave this process.
use lkjstr_protocol::{EventTemplate, UnsignedNostrEvent, finalize_event, generate_secret_key};
#[path = "support/crypto.rs"]
mod crypto;
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
    let mut actors = std::collections::BTreeMap::new();
    for line in io::stdin().lock().lines() {
        let line = line?;
        let value: serde_json::Value = serde_json::from_str(&line)?;
        if let Some(request) = value.get("fixtureCrypto") {
            let owner = request["pubkey"].as_str().ok_or("missing fixture owner")?;
            let actor = actors.get(owner).unwrap_or(&key);
            if lkjstr_protocol::public_key_from_secret(actor).map_err(|_| "bad fixture key")?
                != owner
            {
                return Err("unknown fixture owner".into());
            }
            let result = crypto::crypt(
                actor.as_bytes(),
                request["operation"].as_str().ok_or("missing operation")?,
                request["peer"].as_str().ok_or("missing peer")?,
                request["data"].as_str().ok_or("missing data")?,
            )?;
            println!("{}", json!({"value": result}));
            continue;
        }
        if value["fixtureActor"] == true {
            let actor = generate_secret_key();
            let event = finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: 1700000000,
                    kind: 0,
                    tags: vec![],
                    content: r#"{"name":"wish-actor"}"#.into(),
                },
                &actor,
            )
            .map_err(|_| "actor fixture")?;
            actors.insert(event.pubkey.clone(), actor);
            println!("{}", serde_json::to_string(&event)?);
            continue;
        }
        if let Some(count) = value["fixtureRows"].as_u64() {
            let events = (0..count.min(6000))
                .map(|i| {
                    finalize_event(
                        &EventTemplate {
                            pubkey: None,
                            created_at: 1700100000 + i / 4,
                            kind: 1,
                            tags: vec![],
                            content: format!("Continuity fixture {i}"),
                        },
                        &key,
                    )
                })
                .collect::<Result<Vec<_>, _>>()
                .map_err(|_| "fixture signing failed")?;
            println!("{}", serde_json::to_string(&events)?);
            continue;
        }
        let unsigned: UnsignedNostrEvent = serde_json::from_value(value)?;
        let actor = actors.get(&unsigned.pubkey).unwrap_or(&key);
        let signed = finalize_event(
            &EventTemplate {
                pubkey: Some(unsigned.pubkey),
                created_at: unsigned.created_at,
                kind: unsigned.kind,
                content: unsigned.content,
                tags: unsigned.tags,
            },
            actor,
        )
        .map_err(|_| "fixture signing failed")?;
        println!("{}", serde_json::to_string(&signed)?);
    }
    Ok(())
}

//! Local-only browser smoke fixtures and verification. Outputs public data only.
use std::io::{self, Read};

use lkjstr_protocol::{
    EventPointer, EventTemplate, NostrEvent, ProfilePointer, VerificationResult, encode_nevent,
    encode_note, encode_nprofile, encode_npub, finalize_event, generate_secret_key, reaction_tags,
    reply_tags, verify_event,
};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct Input {
    root: NostrEvent,
    #[serde(default)]
    published: Vec<NostrEvent>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let input: Input = serde_json::from_str(&input)?;
    let verified = std::iter::once(&input.root)
        .chain(&input.published)
        .all(|event| matches!(verify_event(event), VerificationResult::Ok(_)));
    let secret = generate_secret_key();
    let sign = |kind, content: String, tags| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: input.root.created_at + 1,
                kind,
                tags,
                content,
            },
            &secret,
        )
        .map_err(|_| "could not sign browser fixture")
    };
    let metadata = sign(
        0,
        json!({"name": "smoke-person", "display_name": "Smoke Person", "about": "Local fake relay profile"}).to_string(),
        vec![],
    )?;
    let reply = sign(
        1,
        "Fixture reply notification".into(),
        reply_tags(&input.root),
    )?;
    let reaction = sign(7, "+".into(), reaction_tags(&input.root, None))?;
    let remote = sign(1, "remote-only-needle from the search relay".into(), vec![])?;
    let repost = sign(6, String::new(), vec![vec!["e".into(), remote.id.clone()]])?;
    let mut pages = Vec::new();
    for n in 0..85 {
        pages.push(
            finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: input
                        .root
                        .created_at
                        .saturating_sub(if n < 80 { 0 } else { n }),
                    kind: 1,
                    tags: vec![],
                    content: if n < 40 {
                        format!("{{\"noise\":{n}}}")
                    } else {
                        format!("Older readable page note {n}")
                    },
                },
                &secret,
            )
            .map_err(|_| "sign page fixture")?,
        );
    }
    let npub = encode_npub(&metadata.pubkey).map_err(|_| "could not encode public key")?;
    let nprofile = encode_nprofile(&ProfilePointer {
        pubkey: metadata.pubkey.clone(),
        relays: None,
    })
    .map_err(|_| "could not encode profile")?;
    let note = encode_note(&input.root.id).map_err(|_| "could not encode note")?;
    let nevent = encode_nevent(&EventPointer {
        id: input.root.id.clone(),
        relays: None,
        author: Some(input.root.pubkey.clone()),
        kind: Some(1),
    })
    .map_err(|_| "could not encode event")?;
    println!(
        "{}",
        json!({
            "verified": verified, "events": [metadata, reply, reaction], "remote": remote,
            "repost": repost, "pages": pages, "npub": npub, "nprofile": nprofile, "note": note, "nevent": nevent,
        })
    );
    Ok(())
}

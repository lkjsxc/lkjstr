//! Fresh private-list loopback fixtures. No raw key leaves this process.
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey, list_crypto, nip49};
use serde_json::{Value, json};
use std::io::Read;
fn random<const N: usize>() -> Result<[u8; N], std::io::Error> {
    let mut bytes = [0; N];
    std::fs::File::open("/dev/urandom")?.read_exact(&mut bytes)?;
    Ok(bytes)
}
fn account(label: &str) -> Result<Value, Box<dyn std::error::Error>> {
    let key = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
    let peer = SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();
    let note = UnsignedEvent::new(
        peer.public_key(),
        now,
        1,
        vec![],
        "private list fixture note",
    )
    .sign(&peer, &random()?)?;
    let word = format!("private-fixture-{label}");
    let public = format!("public-fixture-{label}");
    let mut events = vec![note.clone()];
    for (kind, tags, entries) in [
        (
            10000,
            vec![vec!["word".into(), public.clone()]],
            vec![vec!["word".into(), word.clone()]],
        ),
        (10003, vec![], vec![vec!["e".into(), note.id.clone()]]),
        (
            30000,
            vec![vec!["d".into(), "fixture".into()]],
            vec![vec!["p".into(), peer.public_key()]],
        ),
    ] {
        events.push(
            UnsignedEvent::new(
                key.public_key(),
                now,
                kind,
                tags,
                list_crypto::encrypt(&entries, &key, &random()?)?,
            )
            .sign(&key, &random()?)?,
        );
    }
    let password = "private-list-loopback-only";
    let encrypted = nip49::encrypt(&key, password, 16, 2, &random()?, &random()?)?.encode()?;
    Ok(
        json!({"pubkey":key.public_key(),"key":encrypted,"password":password,
        "word":word,"public":public,"peer":peer.public_key(),"note":note.id,"events":events}),
    )
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("{}", json!({"accounts":[account("one")?,account("two")?]}));
    Ok(())
}

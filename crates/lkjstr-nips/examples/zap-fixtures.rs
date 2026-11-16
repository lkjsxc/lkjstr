//! Loopback zap provider fixture. Test keys remain inside this native process.
use lkjstr_nips::{
    event::{Event, UnsignedEvent},
    keys::SecretKey,
};
use serde_json::{Value, json};
use std::io::{self, BufRead};
#[path = "../tests/common/invoices.rs"]
mod invoices;
type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
fn key(byte: u8) -> SecretKey {
    match SecretKey::from_bytes([byte; 32]) {
        Ok(key) => key,
        Err(_) => std::process::exit(2),
    }
}
fn tag(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|s| (*s).into()).collect()
}
fn sign(author: u8, kind: u16, content: &str, tags: Vec<Vec<String>>, at: u64) -> Result<Event> {
    let key = key(author);
    Ok(UnsignedEvent::new(key.public_key(), at, kind, tags, content).sign(&key, &[author; 32])?)
}
fn clock() -> Result<u64> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs())
}
fn seed() -> Result<Value> {
    let at = clock()?;
    let metadata = sign(
        2,
        0,
        &json!({"name":"zap fixture recipient","lud16":"receiver@zap.fixture.invalid"}).to_string(),
        vec![],
        at,
    )?;
    let note = sign(2, 1, "Zap provider conformance fixture", vec![], at)?;
    Ok(
        json!({"recipient":key(2).public_key(),"provider":key(4).public_key(),"npub":lkjstr_nips::entity::Entity::Npub(key(2).public_bytes()).encode()?,
        "note":note,"metadata":metadata}),
    )
}
fn response(value: Value) -> Result<Value> {
    match value["op"].as_str() {
        Some("invoice") => {
            let description = value["request"].as_str().ok_or("fixture request")?;
            let request = Event::parse(description, 65536)?;
            request.verify()?;
            let amount = lkjstr_nips::event::unique(&request.data.tags, "amount")?
                .ok_or("fixture amount")?
                .parse::<u64>()?;
            let at = value["at"].as_u64().map_or_else(clock, Ok)?;
            let pr = invoices::invoice_at(description, &format!("lnbc{}p", amount * 10), at);
            let p =
                lkjstr_nips::event::unique(&request.data.tags, "p")?.ok_or("fixture recipient")?;
            let mut tags = vec![
                tag(&["p", p]),
                tag(&["P", &request.data.pubkey]),
                tag(&["bolt11", &pr]),
                tag(&["description", description]),
                tag(&["preimage", &lkjstr_nips::hex(&[7; 32])]),
            ];
            tags.extend(
                request
                    .data
                    .tags
                    .iter()
                    .filter(|t| matches!(t.first().map(String::as_str), Some("e" | "a")))
                    .cloned(),
            );
            let receipt = sign(
                value["provider"].as_u64().unwrap_or(4) as u8,
                9735,
                "",
                tags,
                at,
            )?;
            Ok(json!({"pr":pr,"routes":[],"fixtureReceipt":receipt}))
        }
        Some("duplicate") => {
            let event: Event = serde_json::from_value(value["receipt"].clone())?;
            let at = value["at"].as_u64().unwrap_or(event.data.created_at + 1);
            Ok(serde_json::to_value(sign(
                value["provider"].as_u64().unwrap_or(4) as u8,
                9735,
                "",
                event.data.tags,
                at,
            )?)?)
        }
        Some("event") => Ok(serde_json::to_value(sign(
            value["author"].as_u64().unwrap_or(2) as u8,
            value["kind"].as_u64().unwrap_or(0) as u16,
            value["content"].as_str().unwrap_or(""),
            serde_json::from_value(value["tags"].clone()).unwrap_or_default(),
            value["at"].as_u64().map_or_else(clock, Ok)?,
        )?)?),
        _ => Err("unknown zap fixture command".into()),
    }
}
fn main() -> Result<()> {
    println!("{}", seed()?);
    for line in io::stdin().lock().lines() {
        let input: Value = serde_json::from_str(&line?)?;
        println!("{}", response(input)?);
    }
    Ok(())
}

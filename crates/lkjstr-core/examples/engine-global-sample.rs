//! Offline analysis of the single manual public sample; never opens a socket.
use lkjstr_core::{engine::global::classify, store::Store};
use lkjstr_protocol::{NostrEvent, VerificationResult, verify_event};
use serde::Deserialize;
use serde_json::json;
use std::io::{self, Read};
#[derive(Deserialize)]
struct Sample {
    notes: Vec<NostrEvent>,
    profiles: Vec<NostrEvent>,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let sample: Sample = serde_json::from_str(&input)?;
    let mut store = Store::with_caps(1000, 1000);
    let mut rejected = 0;
    for event in sample
        .profiles
        .into_iter()
        .chain(sample.notes.iter().cloned())
    {
        if matches!(verify_event(&event), VerificationResult::Ok(_)) {
            store.insert(event, None);
        } else {
            rejected += 1;
        }
    }
    let mut notes: Vec<_> = sample
        .notes
        .iter()
        .filter_map(|n| store.get(&n.id))
        .collect();
    notes.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    let held: Vec<_>=notes.iter().zip(classify(&store,&notes, |_|true)).filter_map(|(e,reason)|reason.map(|r|json!({
        "author":store.profile(&e.pubkey).and_then(|p|p.label().map(str::to_owned)).unwrap_or_else(||e.pubkey.chars().take(12).collect()),
        "id":e.id,"reason":format!("{r:?}"),"text":e.content.chars().take(60).collect::<String>()
    }))).collect();
    println!(
        "{}",
        serde_json::to_string_pretty(
            &json!({"sampled":notes.len(),"heldBack":held.len(),"rejected":rejected,"examples":held.iter().take(10).collect::<Vec<_>>(),"allHeld":held})
        )?
    );
    Ok(())
}

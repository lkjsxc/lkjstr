#![allow(dead_code, clippy::unwrap_used)]
use lkjstr_core::{engine::zaps::*, store::Store};
use lkjstr_nips::{
    event::{Event, UnsignedEvent},
    identity::HttpResponse,
    keys::SecretKey,
};
use lkjstr_protocol::NostrEvent;
use serde_json::json;
use std::sync::Arc;
#[path = "../../../../lkjstr-nips/tests/common/invoices.rs"]
pub mod invoices;
pub mod jobs;

pub fn key(byte: u8) -> SecretKey {
    SecretKey::from_bytes([byte; 32]).unwrap()
}
pub fn tag(values: &[&str]) -> Vec<String> {
    values.iter().map(|s| (*s).into()).collect()
}
pub fn raw(event: &Event) -> NostrEvent {
    serde_json::from_value(serde_json::to_value(event).unwrap()).unwrap()
}
pub fn event(author: u8, kind: u16, tags: Vec<Vec<String>>, content: &str, at: u64) -> NostrEvent {
    raw(
        &UnsignedEvent::new(key(author).public_key(), at, kind, tags, content)
            .sign(&key(author), &[author; 32])
            .unwrap(),
    )
}
pub fn profile(store: &mut Store, author: u8, address: &str, at: u64) {
    store.insert(
        event(author, 0, vec![], &json!({"lud16":address}).to_string(), at),
        None,
    );
}
pub fn response(binding: &Binding, provider_key: u8) -> HttpResponse {
    let mut metadata = vec![json!(["text/plain", "Fixture payment"])];
    if let Some(address) = &binding.address {
        metadata.push(json!(["text/identifier", address]));
    }
    HttpResponse {
        status: 200,
        final_url: binding.endpoint.clone(),
        body: json!({
            "tag":"payRequest", "allowsNostr":true,
            "nostrPubkey":key(provider_key).public_key(),
            "callback":"https://ln.test/callback?tag=fixture",
            "minSendable":1,"maxSendable":MAX_MSAT,"commentAllowed":128,
            "metadata":serde_json::to_string(&metadata).unwrap()
        })
        .to_string(),
    }
}
pub fn ready(store: &Store, providers: &mut Providers, recipient: u8, at: u64) -> Arc<Provider> {
    let recipient = key(recipient).public_key();
    let work = providers
        .sync(store, std::slice::from_ref(&recipient), at)
        .unwrap();
    let job = work.fetch.first().unwrap();
    assert!(providers.complete(store, job, Ok(response(&job.binding, 4)), at));
    providers.get(store, &recipient, at).unwrap()
}
pub fn setup() -> (Store, Providers, Target) {
    let mut store = Store::new(1000);
    profile(&mut store, 2, "alice@ln.test", 1);
    let note = event(2, 1, vec![], "note", 1);
    let target = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    let mut providers = Providers::default();
    ready(&store, &mut providers, 2, 100);
    (store, providers, target)
}
pub fn prepared(store: &Store, providers: &Providers, value: &Target, at: u64) -> PreparedRequest {
    invoice_plan(
        store,
        providers,
        &InvoiceInput {
            target: value.clone(),
            amount_msat: 21_000,
            comment: "signed comment".into(),
        },
        &key(1).public_key(),
        &["wss://relay.test".into()],
        at,
    )
    .unwrap()
    .remove(0)
}
pub fn signed(prepared: &PreparedRequest) -> Event {
    prepared.event.clone().sign(&key(1), &[9; 32]).unwrap()
}
pub fn receipt(prepared: &PreparedRequest, at: u64) -> NostrEvent {
    let signed = signed(prepared);
    let description = signed.to_json().unwrap();
    let invoice = invoices::invoice(
        &description,
        &format!("lnbc{}p", prepared.amount_msat * 10),
        false,
    );
    let mut tags = vec![
        tag(&["p", &prepared.provider.binding.recipient]),
        tag(&["P", &key(1).public_key()]),
        tag(&["bolt11", &invoice]),
        tag(&["description", &description]),
        tag(&["preimage", &lkjstr_nips::hex(&[7; 32])]),
    ];
    tags.extend(
        signed
            .data
            .tags
            .iter()
            .filter(|t| matches!(t[0].as_str(), "e" | "a"))
            .cloned(),
    );
    event(4, 9735, tags, "", at)
}
pub fn invoice_response(
    store: &Store,
    prepared: &PreparedRequest,
    at: u64,
) -> (String, String, HttpResponse) {
    let (callback, json) = prepared.callback(store, &signed(prepared), at).unwrap();
    let pr = invoices::invoice(&json, &format!("lnbc{}p", prepared.amount_msat * 10), false);
    let response = HttpResponse {
        status: 200,
        final_url: callback.clone(),
        body: json!({"pr":pr,"routes":[]}).to_string(),
    };
    (callback, json, response)
}

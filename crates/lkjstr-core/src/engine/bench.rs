//! Shared native/WASM timings. Public-shaped synthetic rows never leave this harness.
use crate::store::{Query, Store};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};
pub fn run(clock: impl Fn() -> f64) -> Value {
    let started = clock();
    let mut store = Store::with_caps(100000, 4000);
    for i in 0..100000u64 {
        store.insert(
            NostrEvent {
                id: format!("{i:064x}"),
                pubkey: format!("{:064x}", i % 1000),
                created_at: i,
                kind: 1,
                content: format!("benchmark note {i} #nostr https://example.test/image.png"),
                tags: vec![],
                sig: String::new(),
            },
            None,
        );
    }
    let index_ms = clock() - started;
    let q = Query {
        authors: Some(
            [format!("{:064x}", 1), format!("{:064x}", 2)]
                .into_iter()
                .collect(),
        ),
        kinds: vec![1],
        limit: 200,
        ..Default::default()
    };
    let started = clock();
    let mut selected = 0;
    for _ in 0..100 {
        selected += store.feed(&q).len();
    }
    let query_100_ms = clock() - started;
    let started = clock();
    let newest = store.newest(2000);
    let raw: Vec<_> = newest
        .iter()
        .filter_map(|e| serde_json::to_string(&**e).ok())
        .collect();
    let encode_2000_ms = clock() - started;
    let started = clock();
    let mut restored = Store::with_caps(16000, 4000);
    for raw in &raw {
        if let Ok(e) = serde_json::from_str(raw) {
            restored.insert(e, None);
        }
    }
    let hydrate_2000_ms = clock() - started;
    let started = clock();
    let rows: Vec<_> = newest
        .iter()
        .take(50)
        .map(|e| super::rows::row(&store, e, None, 0))
        .collect();
    let rows_50_ms = clock() - started;
    json!({"stored":store.len(),"selected":selected,"index100kMs":index_ms,"query100Ms":query_100_ms,
        "encode2000Ms":encode_2000_ms,"hydrate2000Ms":hydrate_2000_ms,"rows50Ms":rows_50_ms,
        "rows50Bytes":serde_json::to_vec(&rows).map(|v|v.len()).unwrap_or(0)})
}

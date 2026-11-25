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
                sig: "0".repeat(128),
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
    let mut engine = super::Engine::new();
    engine.signed_out_global_filter = false;
    engine.store = store;
    let mut session = super::wire::Session::default();
    session.queries.insert(
        "rail".into(),
        super::wire::queries::Query {
            source: "global".into(),
            account: Some("benchmark".into()),
            ..Default::default()
        },
    );
    let mut rail_slices = 0;
    let mut rail_max_ms = 0.0f64;
    let mut rail_total_ms = 0.0;
    loop {
        let start = clock();
        let outputs = session.timeline_tick(&engine, 1800000000000 + rail_slices * 25);
        let elapsed = clock() - start;
        rail_max_ms = rail_max_ms.max(elapsed);
        rail_total_ms += elapsed;
        rail_slices += 1;
        if !outputs.is_empty() || rail_slices > 1000 {
            break;
        }
    }
    json!({"rail100kTotalMs":rail_total_ms,"rail100kMaxSliceMs":rail_max_ms,"railSlices":rail_slices,"stored":engine.store.len(),"selected":selected,"index100kMs":index_ms,"query100Ms":query_100_ms,
        "encode2000Ms":encode_2000_ms,"hydrate2000Ms":hydrate_2000_ms,"rows50Ms":rows_50_ms,
        "rows50Bytes":serde_json::to_vec(&rows).map(|v|v.len()).unwrap_or(0)})
}

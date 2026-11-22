#![allow(dead_code)]
use super::{emoji, fixture};
use lkjstr_core::engine::Engine;
use lkjstr_protocol::{NostrEvent, generate_secret_key};

pub struct Fixture {
    pub engine: Engine,
    pub note: NostrEvent,
    pub first: NostrEvent,
    pub second: NostrEvent,
    pub address: String,
    pub beta: String,
}
pub fn setup() -> Fixture {
    let author = generate_secret_key();
    let maker = generate_secret_key();
    let pack = fixture::event(
        &maker,
        30030,
        1,
        "",
        vec![
            vec!["d".into(), "alpha".into()],
            vec!["title".into(), "Alpha".into()],
            emoji("pien", "https://images.test/catalog.png", ""),
            emoji("pien", "https://images.test/note.png", ""),
            emoji("pien", "https://images.test/name.png", ""),
            emoji("pien", "https://images.test/first.png", ""),
        ],
    );
    let address = format!("30030:{}:alpha", pack.pubkey);
    let other = fixture::event(
        &maker,
        30030,
        2,
        "",
        vec![
            vec!["d".into(), "beta".into()],
            vec!["title".into(), "Beta".into()],
            emoji("pien", "https://images.test/second.png", ""),
        ],
    );
    let beta = format!("30030:{}:beta", pack.pubkey);
    let profile = fixture::event(
        &author,
        0,
        3,
        r#"{"name":":pien:","about":":pien:"}"#,
        vec![emoji("pien", "https://images.test/name.png", &address)],
    );
    let note = fixture::event(
        &author,
        1,
        10,
        ":pien: :bare: :unknown:",
        vec![
            emoji("pien", "https://images.test/note.png", &address),
            emoji("bare", "https://images.test/catalog.png", ""),
            emoji(
                "unknown",
                "https://images.test/unknown.png",
                &format!("30030:{}:missing", pack.pubkey),
            ),
        ],
    );
    let picker = fixture::event(
        &author,
        10030,
        4,
        "",
        vec![emoji("pien", "https://images.test/reader.png", &address)],
    );
    let first = fixture::event(
        &generate_secret_key(),
        7,
        12,
        ":pien:",
        vec![
            vec!["e".into(), note.id.clone()],
            vec!["p".into(), note.pubkey.clone()],
            emoji("pien", "https://images.test/first.png", &address),
        ],
    );
    let second = fixture::event(
        &generate_secret_key(),
        7,
        13,
        ":pien:",
        vec![
            vec!["e".into(), note.id.clone()],
            vec!["p".into(), note.pubkey.clone()],
            emoji("pien", "https://images.test/second.png", &beta),
        ],
    );
    let mut engine = Engine::new();
    for event in [&pack, &other, &profile, &note, &picker, &first, &second] {
        engine.store.insert(event.clone(), None);
    }
    Fixture {
        engine,
        note,
        first,
        second,
        address,
        beta,
    }
}

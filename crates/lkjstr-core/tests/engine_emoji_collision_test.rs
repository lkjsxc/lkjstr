#![allow(clippy::expect_used)]
mod engine_emoji_support;
use engine_emoji_support::*;
use lkjstr_core::engine::Engine;
use lkjstr_protocol::generate_secret_key;
use std::collections::BTreeSet;

#[test]
fn collisions_keep_direct_and_each_set_source_with_stable_distinct_keys() {
    let maker = generate_secret_key();
    let owner = generate_secret_key();
    let a = signed(
        &maker,
        10,
        30030,
        vec![
            tag(&["d", "a"]),
            tag(&["title", "Same title"]),
            emoji("pien", "https://images.test/same.png"),
            emoji("pien", "https://images.test/a.png"),
        ],
    );
    let b = signed(
        &maker,
        10,
        30030,
        vec![
            tag(&["d", "b"]),
            tag(&["title", "Same title"]),
            emoji("pien", "https://images.test/same.png"),
        ],
    );
    let direct = tag(&[
        "emoji",
        "pien",
        "https://images.test/same.png",
        &address(&a),
    ]);
    let list = signed(
        &owner,
        20,
        10030,
        vec![
            direct.clone(),
            direct,
            tag(&["a", &address(&a)]),
            tag(&["a", &address(&b)]),
        ],
    );
    let mut engine = Engine::new();
    for event in [&a, &b, &list] {
        engine.store.insert(event.clone(), None);
    }
    let result = rows(&mut engine, Some(&list.pubkey));
    let entries = result["rows"].as_array().expect("rows");
    assert_eq!(entries.len(), 4);
    let own = format!("10030:{}:", list.pubkey);
    assert_eq!(
        entries
            .iter()
            .map(|row| row["source"].as_str().expect("source"))
            .collect::<Vec<_>>(),
        [
            own.as_str(),
            address(&a).as_str(),
            address(&a).as_str(),
            address(&b).as_str()
        ]
    );
    assert_eq!(entries[0]["address"], address(&a));
    assert_eq!(entries[0]["set"], "");
    assert_eq!(entries[1]["set"], "Same title");
    assert_eq!(entries[3]["set"], "Same title");
    let keys: BTreeSet<_> = entries
        .iter()
        .map(|row| row["key"].as_str().expect("key").to_owned())
        .collect();
    assert_eq!(keys.len(), 4);
    assert_ne!(
        entries[0]["key"], entries[1]["key"],
        "direct source stays distinct even with the same address and URL"
    );

    let reordered = signed(
        &owner,
        30,
        10030,
        vec![
            tag(&["a", &address(&b)]),
            tag(&["a", &address(&a)]),
            tag(&[
                "emoji",
                "pien",
                "https://images.test/same.png",
                &address(&a),
            ]),
        ],
    );
    engine.store.insert(reordered, None);
    let repeated = rows(&mut engine, Some(&list.pubkey));
    let repeated: BTreeSet<_> = repeated["rows"]
        .as_array()
        .expect("rows")
        .iter()
        .map(|row| row["key"].as_str().expect("key").to_owned())
        .collect();
    assert_eq!(
        keys, repeated,
        "source ordering does not change a row identity"
    );
}

#[test]
fn row_budget_counts_same_code_with_distinct_pictures() {
    let owner = generate_secret_key();
    let list = signed(
        &owner,
        10,
        10030,
        (0..450)
            .map(|n| emoji("pien", &format!("https://images.test/{n}.png")))
            .collect(),
    );
    let mut engine = Engine::new();
    engine.store.insert(list.clone(), None);
    let result = rows(&mut engine, Some(&list.pubkey));
    let entries = result["rows"].as_array().expect("rows");
    assert_eq!(entries.len(), 400);
    assert_eq!(entries[0]["url"], "https://images.test/0.png");
    assert_eq!(entries[399]["url"], "https://images.test/399.png");
    assert_eq!(
        entries
            .iter()
            .map(|row| row["key"].as_str().expect("key"))
            .collect::<BTreeSet<_>>()
            .len(),
        400
    );
    assert_eq!(result["atBottom"], false);
}

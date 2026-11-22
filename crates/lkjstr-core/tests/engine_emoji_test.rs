#![allow(clippy::expect_used)]
mod engine_emoji_support;
use engine_emoji_support::*;
use lkjstr_core::engine::Engine;
use lkjstr_protocol::generate_secret_key;
use serde_json::json;

#[test]
fn current_owner_references_project_into_the_existing_picker_shape() {
    let mut engine = Engine::new();
    let owner = generate_secret_key();
    let maker = generate_secret_key();
    let mut tags = vec![tag(&["d", "animals"]), tag(&["title", "Animals"])];
    tags.extend([
        emoji("cat", "https://images.test/cat.png"),
        emoji("home", "https://images.test/other.png"),
    ]);
    let set = signed(&maker, 20, 30030, tags);
    let list = signed(
        &owner,
        30,
        10030,
        vec![
            emoji("home", "https://images.test/own.png"),
            tag(&["a", &address(&set)]),
        ],
    );
    for event in [&list, &set] {
        engine.store.insert(event.clone(), None);
    }
    let result = rows(&mut engine, Some(&list.pubkey));
    assert_eq!(
        result["rows"],
        json!([
            {"kind":"emoji","key":row_key(&format!("10030:{}:",list.pubkey),"home","https://images.test/own.png"),"source":format!("10030:{}:",list.pubkey),"code":"home","url":"https://images.test/own.png","set":""},
            {"kind":"emoji","key":row_key(&address(&set),"cat","https://images.test/cat.png"),"source":address(&set),"code":"cat","url":"https://images.test/cat.png","set":"Animals","address":address(&set)},
            {"kind":"emoji","key":row_key(&address(&set),"home","https://images.test/other.png"),"source":address(&set),"code":"home","url":"https://images.test/other.png","set":"Animals","address":address(&set)}
        ])
    );
    assert_eq!(result["atBottom"], true);
}

#[test]
fn replacement_list_withdraws_cached_sets_and_other_owners_cannot_grant_membership() {
    let mut engine = Engine::new();
    let owner = generate_secret_key();
    let other = generate_secret_key();
    let a = set(&other, 10, "a", "apple");
    let b = set(&other, 10, "b", "berry");
    let old = signed(&owner, 10, 10030, vec![tag(&["a", &address(&a)])]);
    let latest = signed(&owner, 20, 10030, vec![tag(&["a", &address(&b)])]);
    let foreign = signed(&other, 30, 10030, vec![tag(&["a", &address(&a)])]);
    for event in [&a, &b, &old] {
        engine.store.insert(event.clone(), None);
    }
    assert_eq!(
        rows(&mut engine, Some(&old.pubkey))["rows"][0]["code"],
        "apple"
    );
    for event in [&latest, &foreign, &old] {
        engine.store.insert(event.clone(), None);
    }
    let result = rows(&mut engine, Some(&old.pubkey));
    assert_eq!(result["rows"].as_array().expect("rows").len(), 1);
    assert_eq!(result["rows"][0]["code"], "berry");
    assert!(
        rows(&mut engine, None)["rows"]
            .as_array()
            .expect("rows")
            .is_empty()
    );
    assert!(
        rows(&mut engine, Some(&"a".repeat(64)))["rows"]
            .as_array()
            .expect("rows")
            .is_empty()
    );
}

#[test]
fn address_selection_uses_author_identifier_newest_time_and_lowest_tied_id() {
    let mut engine = Engine::new();
    let key = generate_secret_key();
    let owner = generate_secret_key();
    let old = set(&key, 10, "group:one", "old");
    let a = set(&key, 20, "group:one", "tie_a");
    let b = set(&key, 20, "group:one", "tie_b");
    let expected = if a.id < b.id { "tie_a" } else { "tie_b" };
    let wrong_id = set(&key, 30, "other", "wrong_id");
    let wrong_author = set(&generate_secret_key(), 30, "group:one", "wrong_author");
    let list = signed(&owner, 40, 10030, vec![tag(&["a", &address(&a)])]);
    for event in [&b, &old, &wrong_author, &a, &wrong_id, &list] {
        engine.store.insert(event.clone(), None);
    }
    let result = rows(&mut engine, Some(&list.pubkey));
    assert_eq!(result["rows"].as_array().expect("rows").len(), 1);
    assert_eq!(result["rows"][0]["code"], expected);
    assert_eq!(result["rows"][0]["set"], "group:one");
    assert_eq!(result["rows"][0]["address"], address(&a));
}

#[test]
fn duplicates_invalid_values_and_recursive_set_references_stay_bounded() {
    let mut engine = Engine::new();
    let key = generate_secret_key();
    let owner = generate_secret_key();
    let indirect = set(&key, 10, "indirect", "not_selected");
    let first = signed(
        &key,
        20,
        30030,
        vec![
            tag(&["d", "first"]),
            emoji("shared", "https://images.test/first.png"),
            emoji("same", "https://images.test/old.png"),
            emoji("same", "https://images.test/new.png"),
            emoji("bad", "javascript:alert(1)"),
            emoji("bad code", "https://images.test/bad.png"),
            tag(&["a", &address(&indirect)]),
        ],
    );
    let second = signed(
        &key,
        20,
        30030,
        vec![
            tag(&["d", "second"]),
            emoji("shared", "https://images.test/second.png"),
        ],
    );
    let list = signed(
        &owner,
        30,
        10030,
        vec![
            tag(&["a", &address(&first)]),
            tag(&["a", &address(&first)]),
            tag(&["a", &address(&second)]),
        ],
    );
    for event in [&indirect, &first, &second, &list] {
        engine.store.insert(event.clone(), None);
    }
    let result = rows(&mut engine, Some(&list.pubkey));
    assert_eq!(result["rows"].as_array().expect("rows").len(), 4);
    assert_eq!(result["rows"][0]["url"], "https://images.test/first.png");
    assert_eq!(result["rows"][1]["url"], "https://images.test/old.png");
    assert_eq!(result["rows"][2]["url"], "https://images.test/new.png");
    assert_eq!(result["rows"][3]["url"], "https://images.test/second.png");
}

#[test]
fn reference_and_row_budgets_bound_the_current_list_without_a_global_catalog() {
    let mut engine = Engine::new();
    let owner = generate_secret_key();
    let maker = generate_secret_key();
    let mut tags = Vec::new();
    for n in 0..40 {
        let event = set(&maker, 20, &format!("set{n}"), &format!("code{n}"));
        tags.push(tag(&["a", &address(&event)]));
        engine.store.insert(event, None);
    }
    let list = signed(&owner, 30, 10030, tags);
    engine.store.insert(list.clone(), None);
    assert_eq!(
        rows(&mut engine, Some(&list.pubkey))["rows"]
            .as_array()
            .expect("rows")
            .len(),
        32
    );
    assert_eq!(rows(&mut engine, Some(&list.pubkey))["atBottom"], false);
    let many = signed(
        &maker,
        40,
        30030,
        (0..450)
            .map(|n| emoji(&format!("many{n}"), "https://images.test/x.png"))
            .chain([tag(&["d", "many"])])
            .collect(),
    );
    let new_list = signed(
        &owner,
        50,
        10030,
        vec![tag(&["a", &format!("30030:{}:many", many.pubkey)])],
    );
    engine.store.insert(many, None);
    engine.store.insert(new_list.clone(), None);
    assert_eq!(
        rows(&mut engine, Some(&list.pubkey))["rows"]
            .as_array()
            .expect("rows")
            .len(),
        400
    );
    assert_eq!(rows(&mut engine, Some(&list.pubkey))["atBottom"], false);
}

#[test]
fn selected_hyphenated_codes_survive_public_reaction_and_private_publication() {
    use lkjstr_core::engine::{dm, wire};
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let target = signed(&generate_secret_key(), 10, 1, vec![]);
    let recipient = signed(&generate_secret_key(), 10, 1, vec![]);
    e.store.insert(target.clone(), None);
    for what in [
        json!({"k":"note","draft":{"text":":hello-world:","emoji":[{"code":"hello-world","url":"https://images.test/hello.png"}]}}),
        json!({"k":"reaction","id":target.id,"emoji":":hello-world:","url":"https://images.test/hello.png"}),
    ] {
        let req = format!("emoji-{}", what["k"].as_str().expect("kind"));
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":req,"action":{"a":"publish","as":target.pubkey,"what":what}}),
            100_000,
        );
        let out = output(&mut s, &mut e);
        let unsigned = out
            .iter()
            .find(|o| o["t"] == "sign")
            .expect("unsigned event");
        let event: serde_json::Value =
            serde_json::from_str(unsigned["event"].as_str().expect("event text")).expect("event");
        assert!(
            event["tags"]
                .as_array()
                .expect("tags")
                .iter()
                .any(|t| t == &json!(["emoji", "hello-world", "https://images.test/hello.png"]))
        );
    }
    let draft: dm::Draft = serde_json::from_value(json!({"text":":hello-world:","recipients":[recipient.pubkey],"emoji":[{"code":"hello-world","url":"https://images.test/hello.png"}]})).expect("draft");
    let rumor = dm::draft(&target.pubkey, &draft, 100).expect("private rumor");
    assert!(
        rumor
            .data
            .tags
            .iter()
            .any(|t| t == &tag(&["emoji", "hello-world", "https://images.test/hello.png"]))
    );
}

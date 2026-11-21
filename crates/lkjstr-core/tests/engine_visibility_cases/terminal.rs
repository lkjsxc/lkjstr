use super::*;

#[test]
fn authorized_deletion_and_expiry_remove_bodies_without_inventing_other_rows() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let author = generate_secret_key();
    let other = generate_secret_key();
    let note = sign(&author, 9, 1, "removed body", &[]);
    let expires = sign(&author, 8, 1, "expires soon", &[&["expiration", "20"]]);
    let already = sign(
        &other,
        7,
        1,
        "expired before observation",
        &[&["expiration", "5"]],
    );
    let malformed = sign(&other, 6, 1, "malformed expiry", &[&["expiration", "bad"]]);
    let mut bad = sign(&author, 10, 5, "", &[&["e", &note.id]]);
    bad.sig = "0".repeat(128);
    let wrong = sign(&other, 11, 5, "", &[&["e", &note.id]]);
    let delete = sign(&author, 12, 5, "", &[&["e", &note.id]]);
    let quote = sign(
        &other,
        13,
        1,
        "quote around the expiry",
        &[&["q", &expires.id]],
    );
    ingest(
        &mut engine,
        15_000,
        &[&note, &expires, &already, &malformed, &bad, &wrong, &quote],
    );
    assert!(!engine.store.verified_deleted(&note.id));
    assert_eq!(engine.rejected, 1);
    assert!(engine.store.get(&already.id).is_none());
    assert!(engine.store.get(&malformed.id).is_none());
    let live = open(
        &mut engine,
        &mut session,
        "feed",
        json!({"source":"global"}),
        15_000,
    );
    assert_eq!(row(&live, &expires)["expiresAt"], 20_000);
    assert_eq!(row(&live, &quote)["expiresAt"], 20_000);
    assert!(row(&live, &note)["hidden"].is_null());
    ingest(&mut engine, 20_000, &[&delete]);
    let output = output(&mut session, &mut engine);
    let shown: Vec<_> = output
        .iter()
        .flat_map(|message| {
            let rows = message["rows"].as_array().into_iter().flatten();
            let patched = message["ops"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|op| op.get("row"));
            rows.chain(patched).cloned().collect::<Vec<_>>()
        })
        .collect();
    assert_eq!(
        row(&shown, &note)["hidden"],
        json!({"reason":"deleted","revealable":false})
    );
    assert_eq!(
        row(&shown, &expires)["hidden"],
        json!({"reason":"expired","revealable":false})
    );
    assert_eq!(
        row(&shown, &quote)["quotes"][0],
        json!({"state":"expired","id":expires.id})
    );
    assert!(engine.store.get(&note.id).is_none() && engine.store.get(&expires.id).is_none());
    for id in [&note.id, &expires.id, &already.id, &malformed.id] {
        assert_eq!(
            action(&mut session, &engine, "feed", id, true)[0]["ok"],
            false
        );
    }
}

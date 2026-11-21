use super::*;

#[test]
fn covered_rows_keep_one_verified_slot_across_sources_and_reveal_only_in_its_view() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let reader = generate_secret_key();
    let person = generate_secret_key();
    let writer = generate_secret_key();
    let stranger = generate_secret_key();
    let root = sign(&writer, 10, 1, "thread root", &[]);
    let reply = sign(
        &writer,
        11,
        1,
        "flagged thread body",
        &[&["e", &root.id, "", "root"], &["e", &root.id, "", "reply"]],
    );
    let muted = sign(
        &person,
        12,
        1,
        "FLAGGED https://secret.example/image.png",
        &[&["t", "wordcase"]],
    );
    let word = sign(&writer, 13, 1, "FLAGGED word body", &[&["t", "wordcase"]]);
    let tag = sign(&writer, 14, 1, "tag body", &[&["t", "wordcase"]]);
    let machine = sign(&writer, 15, 1, "{\"machine\":true}", &[]);
    let quote = sign(&writer, 16, 1, "safe wrapper", &[&["q", &word.id]]);
    let off_network = sign(&stranger, 17, 1, "ordinary off-network", &[]);
    let warning = sign(
        &writer,
        18,
        1,
        "covered by NIP-36 only",
        &[&["content-warning", "spoiler"]],
    );
    let mutes = sign(
        &reader,
        20,
        10000,
        "",
        &[
            &["t", "wordCASE"],
            &["word", "flagged"],
            &["p", &muted.pubkey],
            &["e", &root.id],
        ],
    );
    let follows = sign(
        &reader,
        20,
        3,
        "",
        &[&["p", &muted.pubkey], &["p", &word.pubkey]],
    );
    let bookmarks = sign(&reader, 20, 10003, "", &[&["e", &word.id]]);
    ingest(
        &mut engine,
        25_000,
        &[
            &root,
            &reply,
            &muted,
            &word,
            &tag,
            &machine,
            &quote,
            &off_network,
            &warning,
            &mutes,
            &follows,
            &bookmarks,
        ],
    );
    let account = &follows.pubkey;
    let global = open(
        &mut engine,
        &mut session,
        "global",
        json!({"source":"global","account":account}),
        25_000,
    );
    assert!(row(&global, &off_network)["hidden"].is_null());
    for (event, expected) in [
        (&muted, "muted-person"),
        (&root, "muted-thread"),
        (&reply, "muted-thread"),
        (&word, "muted-word"),
        (&tag, "muted-hashtag"),
        (&machine, "machine-payload"),
    ] {
        let row = row(&global, event);
        assert_eq!(row["hidden"]["reason"], expected);
        assert_eq!(row["key"], event.id);
        for field in ["segments", "media", "quotes", "reactions"] {
            assert_eq!(row[field], json!([]));
        }
        assert!(row["client"].is_null());
        assert!(row["replyTo"].is_null());
        assert_eq!(row["mine"]["own"], false);
    }
    assert_eq!(row(&global, &word)["hidden"]["detail"], "flagged");
    assert_eq!(row(&global, &tag)["hidden"]["detail"], "wordCASE");
    assert_eq!(
        row(&global, &quote)["quotes"][0],
        json!({"id":word.id,"state":"muted"})
    );
    assert_eq!(row(&global, &warning)["cw"], "spoiler");
    assert!(row(&global, &warning)["hidden"].is_null());
    assert_eq!(
        row(&global, &warning)["segments"][0]["text"],
        "covered by NIP-36 only"
    );
    let home = open(
        &mut engine,
        &mut session,
        "home",
        json!({"source":"home","account":account,"replies":false}),
        25_000,
    );
    assert!(
        home.iter()
            .all(|row| row["id"] != off_network.id && row["id"] != reply.id)
    );
    assert_eq!(row(&home, &word)["hidden"]["reason"], "muted-word");
    let profile = open(
        &mut engine,
        &mut session,
        "profile",
        json!({"source":"profile","account":account,"pubkey":word.pubkey,"show":"replies"}),
        25_000,
    );
    assert_eq!(row(&profile, &reply)["hidden"]["reason"], "muted-thread");
    assert!(profile.iter().all(|row| row["id"] != root.id));
    let thread = open(
        &mut engine,
        &mut session,
        "thread",
        json!({"source":"thread","account":account,"id":root.id}),
        25_000,
    );
    assert_eq!(row(&thread, &reply)["thread"]["role"], "reply");
    let bookmarks = open(
        &mut engine,
        &mut session,
        "bookmarks",
        json!({"source":"bookmarks","account":account}),
        25_000,
    );
    assert_eq!(row(&bookmarks, &word)["hidden"]["reason"], "muted-word");
    assert_eq!(
        action(&mut session, &engine, "wrong", &word.id, true)[0]["ok"],
        false
    );
    let shown = action(&mut session, &engine, "global", &word.id, true);
    assert_eq!(
        shown[0]["ops"][0]["row"]["revealed"]["reason"],
        "muted-word"
    );
    assert_eq!(
        shown[0]["ops"][0]["row"]["segments"][0]["text"],
        "FLAGGED word body"
    );
    assert_eq!(shown[0]["ops"][0]["row"]["key"], word.id);
    assert_eq!(
        action(&mut session, &engine, "global", &word.id, true).len(),
        1
    );
    accept(
        &mut session,
        &mut engine,
        json!({"t":"window","sub":"home","anchor":"top","before":0,"after":30}),
        25_000,
    );
    let home = output(&mut session, &mut engine);
    assert!(
        home.iter()
            .find(|message| message["t"] == "rows")
            .expect("home window")["rows"]
            .as_array()
            .expect("note rows")
            .iter()
            .any(|value| value["id"] == word.id && value["hidden"]["reason"] == "muted-word")
    );
    let hidden = action(&mut session, &engine, "global", &word.id, false);
    assert_eq!(hidden[0]["ops"][0]["row"]["segments"], json!([]));
    assert_eq!(hidden[0]["ops"][0]["row"]["hidden"]["reason"], "muted-word");
}

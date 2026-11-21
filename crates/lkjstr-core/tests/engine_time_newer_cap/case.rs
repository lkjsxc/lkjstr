use super::*;

#[test]
fn newer_page_cap_is_stable_when_the_same_pivot_grows() {
    let actor = generate_secret_key();
    let owner = generate_secret_key();
    let notes: Vec<_> = (175..200)
        .rev()
        .map(|at| sign(&actor, 1, at, "", vec![]))
        .collect();
    let list = sign(
        &owner,
        3,
        151,
        "",
        vec![vec!["p".into(), notes[0].pubkey.clone()]],
    );
    let mut f = RelayFixture::new(&[A]);
    start(&mut f, &list, 1, 0);
    for i in 0..8 {
        let page = latest(&f, A);
        assert_eq!(
            page[2]["until"],
            if i == 0 { 200 } else { 199 - 2 * i as u64 }
        );
        f.page(
            A,
            &page[1],
            &[&notes[2 * i], &notes[2 * i + 1], &notes[2 * i + 2]],
        );
        f.tick(150);
        f.tick(150);
    }
    assert_eq!(f.report("feed")["newer"], "partial");
    f.seek("feed", AT, 800, 0);
    f.tick(150);
    assert_eq!(requests(&f, A, 101).len(), 8);
    assert_eq!(f.report("feed")["newer"], "partial");
}

#[test]
fn newer_respects_query_bounds_and_skips_a_future_pivot() {
    let (_, list, _) = fixtures();
    let mut f = RelayFixture::new(&[A]);
    f.engine.store.insert(list.clone(), None);
    f.input(json!({"t":"open","sub":"feed","visible":false,"query":{
        "source":"their-home","pubkey":list.pubkey,"since":104_001,"until":120_999
    }}));
    f.seek("feed", 100_000, 1, 0);
    f.hint(&["feed"]);
    for _ in 0..3 {
        f.tick(150);
    }
    let first = requests(&f, A, 105).pop().unwrap();
    assert_eq!(first[2]["until"], 120);
    f.seek("feed", 220_000, 1, 0);
    f.tick(150);
    assert!(f.closed(A, &first));
    assert_eq!(f.report("feed")["newer"], "cache-only");
    assert_eq!(f.requests(A, 1).len(), 1);
}

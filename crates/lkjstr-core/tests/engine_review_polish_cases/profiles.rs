use super::*;

#[test]
fn profile_absence_requires_successful_untruncated_results_on_all_routes() {
    let relay = "wss://relay.test/";
    let author = "a".repeat(64);
    for outcome in ["empty", "closed", "timeout", "truncated"] {
        let mut n = Network::default();
        n.configure(vec![relay.into()], 0);
        n.relay_information(relay, r#"{"limitation":{"max_limit":1}}"#);
        n.plan(
            vec![(
                "view".into(),
                NostrFilter {
                    kinds: Some(vec![0]),
                    authors: Some(vec![author.clone(), "b".repeat(64)]),
                    limit: Some(2),
                    ..Default::default()
                },
                Query::default(),
            )],
            &lkjstr_core::store::Store::new(0),
            0,
        );
        n.connected(relay, 0);
        n.tick(75);
        let frames = requests(&mut n);
        let id = frames[0][1].clone();
        assert!(!n.profile_absent(&author));
        if outcome == "truncated" {
            let mut profile = note(100, &author);
            profile.kind = 0;
            n.message(relay, &json!(["EVENT", id, profile]).to_string(), 76);
        }
        match outcome {
            "closed" => {
                n.message(
                    relay,
                    &json!(["CLOSED", id, "blocked: fixture"]).to_string(),
                    77,
                );
            }
            "timeout" => n.tick(15076),
            _ => {
                n.message(relay, &json!(["EOSE", id]).to_string(), 77);
            }
        }
        assert!(n.profile_finished(&author, &[]), "{outcome}");
        assert_eq!(n.profile_absent(&author), outcome == "empty", "{outcome}");
        n.verifying = true;
        assert!(!n.profile_absent(&author));
    }
}

#[test]
fn successful_primary_and_failed_fallback_cannot_prove_profile_absence() {
    let routes = ["wss://primary.test/", "wss://fallback.test/"];
    let author = "a".repeat(64);
    let mut n = Network::default();
    n.configure(routes.iter().map(|r| (*r).into()).collect(), 0);
    n.plan(
        vec![(
            "view".into(),
            NostrFilter {
                kinds: Some(vec![0]),
                authors: Some(vec![author.clone()]),
                limit: Some(1),
                ..Default::default()
            },
            Query::default(),
        )],
        &lkjstr_core::store::Store::new(0),
        0,
    );
    n.connected(routes[0], 75);
    let primary = requests(&mut n);
    n.connected(routes[1], 75);
    let fallback = requests(&mut n);
    n.message(routes[0], &json!(["EOSE", primary[0][1]]).to_string(), 76);
    assert!(!n.profile_absent(&author));
    n.message(
        routes[1],
        &json!(["CLOSED", fallback[0][1], "blocked: fixture"]).to_string(),
        77,
    );
    assert!(n.profile_finished(&author, &[]));
    assert!(!n.profile_absent(&author));
}

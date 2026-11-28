#![allow(clippy::expect_used)]
use super::super::*;
use crate::{optimizer::link::Hint, store::Store};
const R: &str = "wss://notifications.test/";
const NOW: u64 = 200_000;

fn query(source: Source) -> Query {
    let mut query = Query {
        source,
        account: Some("a".repeat(64)),
        target: Some("b".repeat(64)),
        ..Default::default()
    };
    query.filters.notifications = Some(true);
    query
}
fn notification(store: &Store, query: &Query) -> NostrFilter {
    let mut news = query.clone();
    news.source = Source::Notifications;
    crate::engine::query::filter(store, &news)
}
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("frame")),
            _ => None,
        })
        .collect()
}
fn setup(focused: bool) -> Network {
    let mut n = Network::default();
    n.configure(vec![R.into()], NOW);
    n.relay_information(
        R,
        &json!({"limitation":{
            "max_filters":2,"max_subscriptions":1
        }})
        .to_string(),
    );
    n.focused_sub = focused.then(|| "feed".into());
    n
}

#[test]
fn notification_policy_heads_share_the_views_priority() {
    let store = Store::new(100);
    for source in [
        Source::Notifications,
        Source::Home,
        Source::Global,
        Source::TheirHome,
    ] {
        for focused in [false, true] {
            let q = query(source);
            let mut n = setup(focused);
            n.plan(
                vec![("feed".into(), notification(&store, &q), q)],
                &store,
                NOW,
            );
            let request = n.requests.values().next().expect("notification head");
            eprintln!(
                "notification policy {source:?} focused={focused}: priority={} purpose={}",
                request.priority, request.purpose
            );
            assert_eq!(
                (request.priority, request.purpose),
                if focused {
                    (0, "focused")
                } else {
                    (1, "visible")
                }
            );
        }
    }
}

#[test]
fn notification_policy_thin_heads_keep_the_same_initial_quota() {
    let store = Store::new(100);
    for source in [
        Source::Notifications,
        Source::Home,
        Source::Global,
        Source::TheirHome,
    ] {
        let q = query(source);
        let mut n = setup(false);
        n.optimizer.link.set_hint(Some(Hint::VeryThin));
        n.plan(
            vec![("feed".into(), notification(&store, &q), q)],
            &store,
            NOW,
        );
        n.connected(R, NOW + 1);
        let requests = frames(&mut n);
        let request = requests
            .iter()
            .find(|f| f[0] == "REQ")
            .expect("notification REQ");
        eprintln!("notification quota {source:?}: {}", request[2]["limit"]);
        assert_eq!(request[2]["limit"], 8);
    }
}

#[test]
fn notification_policy_mixed_head_sends_before_an_unanswered_feed_eose() {
    let store = Store::new(100);
    for source in [Source::Home, Source::Global, Source::TheirHome] {
        let q = query(source);
        let mut n = setup(true);
        n.plan(
            vec![
                (
                    "feed".into(),
                    crate::engine::query::filter(&store, &q),
                    q.clone(),
                ),
                ("feed".into(), notification(&store, &q), q),
            ],
            &store,
            NOW,
        );
        n.connected(R, NOW + 1);
        let initial = frames(&mut n);
        let first = initial.iter().find(|f| f[0] == "REQ").expect("feed REQ");
        let is_news = |frame: &Value| {
            frame[0] == "REQ"
                && frame.as_array().expect("frame")[2..]
                    .iter()
                    .any(|f| f["#p"] == json!(["a".repeat(64)]))
        };
        let mut first_news = initial.iter().any(is_news).then_some(1);
        for elapsed in (101..4000).step_by(100) {
            n.tick(NOW + elapsed);
            if frames(&mut n).iter().any(is_news) {
                first_news.get_or_insert(elapsed);
            }
        }
        n.message(R, &json!(["EOSE", first[1]]).to_string(), NOW + 4000);
        n.tick(NOW + 4001);
        if frames(&mut n).iter().any(is_news) {
            first_news.get_or_insert(4001);
        }
        eprintln!(
            "mixed notification {source:?}: first #p REQ at {first_news:?} ms; initial filters={}",
            first.as_array().expect("frame").len() - 2
        );
        assert_eq!(first_news, Some(1));
        assert_eq!(first.as_array().expect("frame").len(), 4);
    }
}

#[test]
fn notification_policy_history_keeps_its_inclusive_quota_and_hydration_stays_secondary() {
    let store = Store::new(100);
    let q = query(Source::Home);
    let mut history = notification(&store, &q);
    history.until = Some(190);
    let mut n = setup(false);
    n.optimizer.link.set_hint(Some(Hint::VeryThin));
    n.plan(vec![("feed".into(), history, q.clone())], &store, NOW);
    let request = n.requests.values().next().expect("notification history");
    assert_eq!((request.priority, request.purpose), (1, "history"));
    assert_eq!(n.planned_limit(request, NOW), 200);
    let mut hydration = notification(&store, &q);
    hydration.kinds = Some(vec![3]);
    n.plan(vec![("feed".into(), hydration, q)], &store, NOW + 1);
    let request = n.requests.values().next().expect("followers hydration");
    assert_eq!((request.priority, request.purpose), (3, "hydration"));
}

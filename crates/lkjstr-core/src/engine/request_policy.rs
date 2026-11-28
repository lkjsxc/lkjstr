//! Explicit work order. A shared request takes its most urgent member's purpose.
use super::*;
impl Network {
    pub(super) fn request_policy<'a>(
        &mut self,
        queries: &BTreeMap<String, &'a Query>,
        store: &crate::store::Store,
        weights: &mut crate::engine::weights::PlanWeights<'a>,
    ) {
        for r in self.requests.values_mut() {
            let mut choice = (4, "prefetch", 0);
            for member in &r.members {
                let q = queries.get(member);
                let own = member == "~account-discovery"
                    || member.starts_with("~publication:")
                    || member.starts_with("~list-action:")
                    || member.starts_with("~dm-list:")
                    || q.and_then(|q| q.account.as_ref()).is_some_and(|account| {
                        r.filter.authors.as_deref() == Some(std::slice::from_ref(account))
                            && r.filter.kinds.as_ref().is_some_and(|ks| {
                                ks.iter().all(|k| {
                                    matches!(
                                        k,
                                        0 | 3
                                            | 10000
                                            | 10001
                                            | 10002
                                            | 10003
                                            | 10005
                                            | 10030
                                            | 10063
                                    )
                                })
                            })
                    });
                let primary = q.is_some_and(|q| {
                    // Mixed feeds own both heads; their notification half is visible work.
                    std::iter::once(crate::engine::query::filter(store, q))
                        .chain(crate::engine::history::notification_filter(store, q))
                        .any(|mut head| {
                            head.until = r.page_filter.until;
                            crate::engine::filter_identity::canonical(head) == r.page_filter
                        })
                });
                let profile_header = q.is_some_and(|q| {
                    q.source == Source::Profile
                        && q.target.as_ref().is_some_and(|target| {
                            r.filter
                                .authors
                                .as_ref()
                                .is_some_and(|a| a.contains(target))
                        })
                        && r.filter.tags.is_empty()
                        && matches!(r.filter.kinds.as_deref(), Some([0] | [3] | [10002]))
                });
                let background = (r.filter.kinds.as_deref() == Some(&[0])
                    && r.filter
                        .authors
                        .as_ref()
                        .is_some_and(|authors| authors.iter().all(|a| store.profile(a).is_some())))
                    || (r.filter.tags.contains_key("e")
                        && q.is_some_and(|q| q.source != Source::Thread));
                let (priority, purpose) = if member.starts_with("~repair:")
                    || member.starts_with("~prefetch:")
                {
                    (4, "prefetch")
                } else if profile_header && self.focused_sub.as_ref() == Some(member) {
                    (0, "focused")
                } else if own {
                    (2, "own")
                } else if member.starts_with("@client-info:") {
                    (1, "visible")
                } else if member.starts_with("~dm:") || member.starts_with("~dm-legacy:") {
                    (
                        1,
                        if r.page_filter.until.is_some() {
                            "history"
                        } else {
                            "visible"
                        },
                    )
                } else if let Some(sub) = crate::engine::time_window_relay::view_owner(member) {
                    if self.focused_sub.as_deref() == Some(sub) {
                        (0, "focused")
                    } else {
                        (1, "history")
                    }
                } else if primary && self.focused_sub.as_ref() == Some(member) {
                    (0, "focused")
                } else if primary || profile_header {
                    (
                        1,
                        if r.page_filter.until.is_some() {
                            "history"
                        } else {
                            "visible"
                        },
                    )
                } else if q.is_some_and(|q| q.source == Source::Channels)
                    && (r.filter.ids.is_some()
                        || (r.filter.kinds.as_deref() == Some(&[41]) && r.filter.tags.is_empty()))
                {
                    (1, "visible")
                } else if background {
                    (4, "prefetch")
                } else if r
                    .filter
                    .kinds
                    .as_deref()
                    .is_some_and(|ks| ks == [0] || ks == [3])
                    || (q.is_some_and(|q| q.source == Source::Emoji)
                        && r.filter.kinds.as_deref() == Some(&[30030]))
                    || r.filter.ids.is_some()
                    || r.filter.tags.contains_key("e")
                    || r.filter.tags.contains_key("p")
                {
                    (3, "hydration")
                } else {
                    (4, "prefetch")
                };
                let weight = q
                    .map(|q| weights.request(q.account.as_deref(), &r.filter))
                    .unwrap_or(1);
                if priority < choice.0 || (priority == choice.0 && weight > choice.2) {
                    choice = (priority, purpose, weight);
                }
            }
            (r.priority, r.purpose, r.weight) = choice;
        }
    }
}

#[cfg(test)]
#[path = "request_notification_test.rs"]
mod notification_tests;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::Store;
    use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

    #[test]
    fn tagged_kind3_follower_read_is_hydration_and_does_not_stamp_owner_list() {
        let relay = "wss://a.test/";
        let target = "a".repeat(64);
        let event = finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: 1,
                kind: 3,
                content: String::new(),
                tags: vec![vec!["p".into(), target.clone()]],
            },
            &generate_secret_key(),
        )
        .unwrap_or_else(|_| unreachable!());
        let mut store = Store::new(20);
        let mut network = Network::default();
        network.configure(vec![relay.into()], 100_000);
        network.focused_sub = Some("profile".into());
        let mut filter = NostrFilter {
            kinds: Some(vec![3]),
            authors: Some(vec![target.clone(), event.pubkey.clone()]),
            limit: Some(200),
            ..Default::default()
        };
        filter.tags.insert("p".into(), vec![target.clone()]);
        network.plan(
            vec![(
                "profile".into(),
                filter,
                Query {
                    source: Source::Profile,
                    target: Some(target),
                    ..Default::default()
                },
            )],
            &store,
            100_000,
        );
        network.connected(relay, 100_050);
        let request = network
            .requests
            .values()
            .find(|r| r.filter.tags.contains_key("p"))
            .unwrap_or_else(|| unreachable!());
        assert!(request.sent && request.asked);
        assert_eq!((request.priority, request.purpose), (3, "hydration"));
        let wire = request.wire_id.clone();
        let received = network
            .message(relay, &json!(["EVENT", wire, event]).to_string(), 100_060)
            .unwrap_or_else(|| unreachable!());
        assert_eq!(received.id, event.id);
        store.insert(received.clone(), None);
        network.observe_verified(relay, &received, 100_061);
        assert!(!network.metadata_fresh(&store, &received.pubkey, 3, 100_062));
        network.message(relay, &json!(["EOSE", wire]).to_string(), 100_070);
        assert!(!network.metadata_fresh(&store, &received.pubkey, 3, 100_071));
        network.plan(vec![], &store, 100_072);
        assert!(!network.metadata_fresh(&store, &received.pubkey, 3, 100_073));
    }
}

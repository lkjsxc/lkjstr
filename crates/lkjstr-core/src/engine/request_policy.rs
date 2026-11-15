//! Explicit work order. A shared request takes its most urgent member's purpose.
use super::*;
impl Network {
    pub(super) fn request_policy(
        &mut self,
        queries: &BTreeMap<String, Query>,
        store: &crate::store::Store,
        private: &crate::engine::settings::PrivateLists,
    ) {
        let policies: BTreeMap<_, _> = queries
            .values()
            .map(|q| {
                (
                    q.account.as_deref(),
                    crate::engine::weights::Weights::new(store, private, q.account.as_deref()),
                )
            })
            .collect();
        for r in self.requests.values_mut() {
            let mut choice = (4, "prefetch", 0);
            for member in &r.members {
                let q = queries.get(member);
                let own = member == "~account-discovery"
                    || member.starts_with("~publication:")
                    || member.starts_with("~channel-action:")
                    || q.and_then(|q| q.account.as_ref()).is_some_and(|account| {
                        r.filter.authors.as_deref() == Some(std::slice::from_ref(account))
                            && r.filter.kinds.as_ref().is_some_and(|ks| {
                                ks.iter().all(|k| {
                                    matches!(
                                        k,
                                        0 | 3 | 10000 | 10002 | 10003 | 10005 | 10030 | 10063
                                    )
                                })
                            })
                    });
                let primary = q.is_some_and(|q| {
                    let mut head = crate::engine::query::filter(store, q);
                    head.until = r.page_filter.until;
                    head == r.page_filter
                });
                let (priority, purpose) = if own {
                    (2, "own")
                } else if primary && self.focused_sub.as_ref() == Some(member) {
                    (0, "focused")
                } else if primary && q.is_some_and(|q| q.source == Source::Notifications) {
                    (2, "notifications")
                } else if primary {
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
                } else if r
                    .filter
                    .kinds
                    .as_deref()
                    .is_some_and(|ks| ks == [0] || ks == [3])
                    || r.filter.ids.is_some()
                    || r.filter.tags.contains_key("e")
                    || r.filter.tags.contains_key("p")
                {
                    (3, "hydration")
                } else {
                    (4, "prefetch")
                };
                let weight = q
                    .map(|q| {
                        let weights = &policies[&q.account.as_deref()];
                        r.filter
                            .authors
                            .iter()
                            .flatten()
                            .map(|p| weights.person(p))
                            .chain(
                                r.filter
                                    .ids
                                    .iter()
                                    .flatten()
                                    .chain(r.filter.tags.get("e").into_iter().flatten())
                                    .filter_map(|id| store.get(id))
                                    .map(|e| weights.event(&e)),
                            )
                            .max()
                            .unwrap_or(1)
                    })
                    .unwrap_or(1);
                if priority < choice.0 || (priority == choice.0 && weight > choice.2) {
                    choice = (priority, purpose, weight);
                }
            }
            (r.priority, r.purpose, r.weight) = choice;
        }
    }
}

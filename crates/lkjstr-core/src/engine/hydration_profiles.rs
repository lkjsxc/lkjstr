//! Stable relay-targeted hydration plus bounded verified-author write routes.
use super::*;

// The normal outbox planner still owns route selection and its twelve-route admission cap.
fn known_writer(engine: &Engine, author: &str) -> bool {
    engine
        .store
        .relay_list(author)
        .unwrap_or_default()
        .into_iter()
        .take(64)
        .any(|(url, _, write)| {
            write
                && super::super::settings::strict_relay(&url).is_some_and(|url| {
                    !engine.network.relay_order.contains(&url)
                        || engine
                            .network
                            .known
                            .get(&url)
                            .is_none_or(|usage| usage.read)
                })
        })
}

pub(super) fn wants(engine: &Engine, now: u64) -> Vec<(String, NostrFilter, Query)> {
    // 128 visible views x 6000 authors; requests chunk at 120 per relay.
    let mut wants = Vec::new();
    let mut batches: BTreeMap<String, BTreeMap<String, BTreeSet<String>>> = BTreeMap::new();
    let reads: Vec<_> = engine
        .network
        .relay_order
        .iter()
        .filter(|u| engine.network.known.get(*u).is_none_or(|r| r.read))
        .cloned()
        .collect();
    for (sub, view) in engine.views.iter().filter(|(_, v)| v.visible) {
        let weights = super::super::weights::Weights::new(
            &engine.store,
            &engine.private_lists,
            view.query.account.as_deref(),
        );
        let mut people: Vec<_> = authors(
            &engine.store,
            view,
            &engine.network,
            engine.signed_out_global_filter,
            &engine.private_lists,
        )
        .into_iter()
        .filter(|(author, _)| {
            matches!(
                view.query.source,
                Source::Following | Source::Followers | Source::List
            ) || weights.person(author) > 0
        })
        .collect();
        people
            .sort_by_key(|(author, _)| (std::cmp::Reverse(weights.person(author)), author.clone()));
        people.truncate(6000);
        let mut advertised = Vec::new();
        for (author, seen) in people {
            if engine
                .network
                .metadata_fresh(&engine.store, &author, 0, now)
            {
                continue;
            }
            if engine.store.profile(&author).is_none() && known_writer(engine, &author) {
                advertised.push(author.clone());
            }
            let delivered: Vec<_> = seen
                .into_iter()
                .filter(|u| {
                    reads.contains(u)
                        || (engine.network.read_outboxes.contains(u)
                            && engine.network.known.get(u).is_none_or(|r| r.read)
                            && engine.network.relays.get(u).is_some_and(|r| r.online))
                })
                .take(1)
                .collect();
            let first = if delivered.is_empty() {
                reads.iter().take(1).cloned().collect()
            } else {
                delivered
            };
            let routes = if engine.network.profile_finished(&author, &first) {
                reads
                    .iter()
                    .take(2)
                    .cloned()
                    .chain(first.iter().cloned())
                    .collect()
            } else {
                first
            };
            for relay in routes {
                batches
                    .entry(relay)
                    .or_default()
                    .entry(author.clone())
                    .or_default()
                    .insert(if engine.store.profile(&author).is_some() {
                        format!("~prefetch:{sub}")
                    } else {
                        sub.clone()
                    });
            }
        }
        for chunk in advertised.chunks(120) {
            wants.push((
                sub.clone(),
                NostrFilter {
                    authors: Some(chunk.to_vec()),
                    kinds: Some(vec![0]),
                    limit: Some(chunk.len() as u64),
                    ..Default::default()
                },
                Query {
                    source: Source::Profile,
                    account: view.query.account.clone(),
                    ..Default::default()
                },
            ));
        }
    }
    for (relay, people) in batches {
        let people: Vec<_> = people.into_iter().collect();
        for chunk in people.chunks(120) {
            let filter = NostrFilter {
                authors: Some(chunk.iter().map(|(a, _)| a.clone()).collect()),
                kinds: Some(vec![0]),
                limit: Some(chunk.len() as u64),
                ..Default::default()
            };
            let members: BTreeSet<_> = chunk
                .iter()
                .flat_map(|(_, subs)| subs.iter().cloned())
                .collect();
            for sub in members {
                wants.push((
                    sub,
                    filter.clone(),
                    Query {
                        source: Source::Relay,
                        target: Some(relay.clone()),
                        ..Default::default()
                    },
                ));
            }
        }
    }
    wants
}

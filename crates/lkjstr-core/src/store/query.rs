//! Read paths over the store: feeds, threads, notifications, search.

use std::collections::{HashSet, VecDeque};

use super::{Event, OrderedEvent, Store, decode_id};
use crate::kinds::{ActKind, policy};
use lkjstr_protocol::parse_relay_list_suggestions;
use lkjstr_protocol::{follow_entries_from_event, reply_parent, reply_root};

/// A feed query. Empty `authors` means any author.
#[derive(Debug, Clone, Default)]
pub struct Query {
    pub authors: Option<HashSet<String>>,
    pub kinds: Vec<u64>,
    pub mention: Option<String>,
    pub exclude_author: Option<String>,
    pub until: Option<u64>,
    pub limit: usize,
}

impl Store {
    /// Indexed, tie-stable scan; exclusive cursor survives equal timestamps. At most `limit` clones.
    pub fn scan(&self, before: Option<&(u64, String)>, limit: usize) -> Vec<Event> {
        use std::ops::Bound::{Excluded, Unbounded};
        let cursor = before.and_then(|(at, id)| decode_id(id).map(|id| (*at, id)));
        let end = cursor.as_ref().map_or(Unbounded, Excluded);
        self.by_time
            .range::<super::compact::OrderKey, _>((Unbounded, end))
            .rev()
            .take(limit)
            .map(|key| key.0.materialize())
            .collect()
    }

    /// Newest-first events matching `query`; decode only selected results.
    pub fn feed(&self, query: &Query) -> Vec<Event> {
        self.feed_since(query, None)
    }

    pub(crate) fn feed_since(&self, query: &Query, since: Option<u64>) -> Vec<Event> {
        self.feed_iter_since(query, since).collect()
    }

    pub(crate) fn feed_iter_since<'a>(
        &'a self,
        query: &'a Query,
        since: Option<u64>,
    ) -> impl Iterator<Item = Event> + 'a {
        let source: Box<dyn Iterator<Item = &OrderedEvent>> = match &query.mention {
            Some(pubkey) => match decode_id(pubkey).and_then(|key| self.by_tag_p.get(&key)) {
                Some(set) => Box::new(set.iter().rev()),
                None => Box::new(std::iter::empty()),
            },
            None => match &query.authors {
                Some(authors) => Box::new(self.author_feed(authors)),
                _ => Box::new(self.by_time.iter().rev()),
            },
        };
        let authors = query.authors.as_ref().map(|values| {
            values
                .iter()
                .filter_map(|key| decode_id(key))
                .collect::<HashSet<_>>()
        });
        let excluded = query.exclude_author.as_deref().and_then(decode_id);
        source
            .map(|key| &key.0)
            .take_while(move |event| since.is_none_or(|since| event.order.0 >= since))
            .filter(|event| query.until.is_none_or(|until| event.order.0 <= until))
            .filter(|event| query.kinds.is_empty() || query.kinds.contains(&event.kind))
            .filter(move |event| {
                authors
                    .as_ref()
                    .is_none_or(|authors| authors.contains(event.pubkey()))
            })
            .filter(move |event| excluded.as_ref() != Some(event.pubkey()))
            .take(query.limit)
            .map(|event| event.materialize())
    }

    /// Ids of events that reference `id` with an `e` or `q` tag.
    pub fn referencing(&self, id: &str) -> Vec<Event> {
        decode_id(id)
            .and_then(|key| self.by_tag_e.get(&key))
            .into_iter()
            .flatten()
            .map(|event| event.materialize())
            .collect()
    }

    /// Reactions to this note, excluding ancestor and quote references.
    pub fn reactions(&self, id: &str) -> Vec<Event> {
        self.referencing(id)
            .into_iter()
            .filter(|e| policy(e.kind).act == Some(ActKind::Reaction) && is_action_target(e, id))
            .collect()
    }

    /// Every stored note in the conversation around `focus`, oldest first.
    pub fn thread(&self, root: &str) -> Vec<Event> {
        if self
            .get(root)
            .is_some_and(|event| !policy(event.kind).openable)
        {
            return Vec::new();
        }
        let mut seen = HashSet::new();
        let mut queue = VecDeque::from([root.to_owned()]);
        let mut out = Vec::new();
        while let Some(id) = queue.pop_front() {
            if !seen.insert(id.clone()) {
                continue;
            }
            if let Some(event) = self.get(&id).filter(|event| policy(event.kind).openable) {
                queue.extend(
                    [
                        (event.kind == 1111)
                            .then(|| crate::comments::parent(self, &event))
                            .flatten(),
                        (event.kind == 1111)
                            .then(|| crate::comments::root(self, &event))
                            .flatten(),
                        policy(event.kind)
                            .thread_parent
                            .then(|| reply_parent(&event))
                            .flatten(),
                        policy(event.kind)
                            .thread_root
                            .then(|| reply_root(&event))
                            .flatten(),
                    ]
                    .into_iter()
                    .flatten(),
                );
                out.push(event);
            }
            for child in decode_id(&id)
                .and_then(|id| self.by_tag_e.get(&id))
                .into_iter()
                .flatten()
            {
                let event = child.materialize();
                if policy(event.kind).reply && is_reply_to(&event, &id)
                    || event.kind == 1111
                        && crate::comments::parent(self, &event).as_deref() == Some(id.as_str())
                {
                    queue.push_back(child.id_hex());
                }
            }
            // Address-scoped NIP-22 comments are indexed by the exact coordinate.
            if let Some(address) = self
                .get(&id)
                .and_then(|event| crate::comments::address(&event))
            {
                for child in self.by_comment_address.get(&address).into_iter().flatten() {
                    if crate::comments::parent(self, &child.materialize()).as_deref()
                        == Some(id.as_str())
                    {
                        queue.push_back(child.id_hex());
                    }
                }
            }
        }
        out.sort_by(|a, b| (a.created_at, &a.id).cmp(&(b.created_at, &b.id)));
        out
    }

    /// Accounts `pubkey` follows, from its newest stored kind 3.
    pub fn follows(&self, pubkey: &str) -> Option<Vec<String>> {
        let event = self.replaceable(pubkey, 3)?;
        Some(
            follow_entries_from_event(&event)
                .into_iter()
                .map(|entry| entry.pubkey)
                .collect(),
        )
    }

    /// NIP-65 relays of `pubkey`: (url, read, write).
    pub fn relay_list(&self, pubkey: &str) -> Option<Vec<(String, bool, bool)>> {
        let event = self.replaceable(pubkey, 10002)?;
        Some(
            parse_relay_list_suggestions(&event)
                .into_iter()
                .map(|item| (item.relay_url, item.read, item.write))
                .collect(),
        )
    }

    /// Newest events first, for persistence snapshots.
    pub fn newest(&self, limit: usize) -> Vec<Event> {
        self.by_time
            .iter()
            .rev()
            .map(|key| &key.0)
            .take(limit)
            .map(|event| event.materialize())
            .collect()
    }

    /// Kind 7 reactions, kind 6 reposts and kind 1 replies pointing at `id`.
    pub fn counts(&self, id: &str) -> (usize, usize, usize) {
        let mut out = (0, 0, 0);
        for event in self.referencing(id) {
            match Some(event.as_ref()) {
                Some(e) if policy(e.kind).reply && is_reply_to(e, id) => out.0 += 1,
                Some(e)
                    if policy(e.kind).act == Some(ActKind::Repost) && is_action_target(e, id) =>
                {
                    out.1 += 1
                }
                Some(e)
                    if policy(e.kind).act == Some(ActKind::Reaction) && is_action_target(e, id) =>
                {
                    out.2 += 1
                }
                _ => {}
            }
        }
        out
    }
}

fn is_reply_to(event: &lkjstr_protocol::NostrEvent, id: &str) -> bool {
    reply_parent(event).as_deref() == Some(id)
        || (policy(event.kind).thread_root && reply_root(event).as_deref() == Some(id))
}

fn is_action_target(event: &lkjstr_protocol::NostrEvent, id: &str) -> bool {
    event
        .tags
        .iter()
        .rev()
        .find(|tag| tag.first().is_some_and(|key| key == "e"))
        .and_then(|tag| tag.get(1))
        .is_some_and(|target| target == id)
}

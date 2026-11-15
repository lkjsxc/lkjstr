//! Read paths over the store: feeds, threads, notifications, search.

use std::collections::{HashSet, VecDeque};

use lkjstr_protocol::parse_relay_list_suggestions;
use lkjstr_protocol::{follow_entries_from_event, reply_parent, reply_root};

use super::{Event, Store};

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

/// Upper bound on events one thread walk visits.
const MAX_THREAD: usize = 500;

impl Store {
    /// Newest-first events matching `query`.
    pub fn feed(&self, query: &Query) -> Vec<Event> {
        let source: Box<dyn Iterator<Item = &(u64, String)>> = match &query.mention {
            Some(pubkey) => match self.by_tag_p.get(pubkey) {
                Some(set) => Box::new(set.iter().rev()),
                None => return Vec::new(),
            },
            None => match &query.authors {
                Some(authors) => Box::new(self.author_feed(authors)),
                _ => Box::new(self.by_time.iter().rev()),
            },
        };
        source
            .filter(|(at, _)| query.until.is_none_or(|until| *at <= until))
            .filter_map(|(_, id)| self.events.get(id))
            .filter(|event| query.kinds.is_empty() || query.kinds.contains(&event.kind))
            .filter(|event| {
                query
                    .authors
                    .as_ref()
                    .is_none_or(|authors| authors.contains(&event.pubkey))
            })
            .filter(|event| query.exclude_author.as_ref() != Some(&event.pubkey))
            .take(query.limit)
            .cloned()
            .collect()
    }

    /// Ids of events that reference `id` with an `e` or `q` tag.
    pub fn referencing(&self, id: &str) -> Vec<Event> {
        self.by_tag_e
            .get(id)
            .map(|ids| ids.iter().filter_map(|id| self.get(id)).collect())
            .unwrap_or_default()
    }

    /// Reactions to this note, excluding ancestor and quote references.
    pub fn reactions(&self, id: &str) -> Vec<Event> {
        self.referencing(id)
            .into_iter()
            .filter(|e| {
                e.kind == 7 && lkjstr_protocol::reaction_target_event_id(e).as_deref() == Some(id)
            })
            .collect()
    }

    /// Every stored note in the conversation around `focus`, oldest first.
    pub fn thread(&self, root: &str) -> Vec<Event> {
        let mut seen = HashSet::new();
        let mut queue = VecDeque::from([root.to_owned()]);
        let mut out = Vec::new();
        while let Some(id) = queue.pop_front() {
            if out.len() >= MAX_THREAD || !seen.insert(id.clone()) {
                continue;
            }
            if let Some(event) = self.get(&id).filter(|event| event.kind == 1) {
                queue.extend(
                    [reply_parent(&event), reply_root(&event)]
                        .into_iter()
                        .flatten(),
                );
                out.push(event);
            }
            for child in self.by_tag_e.get(&id).into_iter().flatten() {
                if self
                    .get(child)
                    .is_some_and(|event| event.kind == 1 && is_reply_to(&event, &id))
                {
                    queue.push_back(child.clone());
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

    /// Case-insensitive text match over notes, newest first.
    pub fn search_notes(&self, needle: &str, limit: usize) -> Vec<Event> {
        let needle = needle.to_lowercase();
        if needle.trim().is_empty() {
            return Vec::new();
        }
        self.by_time
            .iter()
            .rev()
            .filter_map(|(_, id)| self.events.get(id))
            .filter(|event| event.kind == 1 && event.content.to_lowercase().contains(&needle))
            .take(limit)
            .cloned()
            .collect()
    }

    /// People whose name, display name or NIP-05 contains `needle`.
    pub fn search_people(&self, needle: &str, limit: usize) -> Vec<String> {
        let needle = needle.to_lowercase();
        if needle.trim().is_empty() {
            return Vec::new();
        }
        let mut found: Vec<&String> = self
            .profiles
            .iter()
            .filter(|(_, profile)| {
                [&profile.name, &profile.display_name, &profile.nip05]
                    .iter()
                    .any(|field| field.to_lowercase().contains(&needle))
            })
            .map(|(pubkey, _)| pubkey)
            .collect();
        found.sort();
        found.into_iter().take(limit).cloned().collect()
    }

    /// Newest events first, for persistence snapshots.
    pub fn newest(&self, limit: usize) -> Vec<Event> {
        self.by_time
            .iter()
            .rev()
            .filter_map(|(_, id)| self.events.get(id))
            .take(limit)
            .cloned()
            .collect()
    }

    /// Kind 7 reactions, kind 6 reposts and kind 1 replies pointing at `id`.
    pub fn counts(&self, id: &str) -> (usize, usize, usize) {
        let mut out = (0, 0, 0);
        for event in self.by_tag_e.get(id).into_iter().flatten() {
            match self.events.get(event) {
                Some(e) if e.kind == 1 && is_reply_to(e, id) => out.0 += 1,
                Some(e) if e.kind == 6 && is_action_target(e, id) => out.1 += 1,
                Some(e) if e.kind == 7 && is_action_target(e, id) => out.2 += 1,
                _ => {}
            }
        }
        out
    }
}

fn is_reply_to(event: &lkjstr_protocol::NostrEvent, id: &str) -> bool {
    reply_parent(event).as_deref() == Some(id) || reply_root(event).as_deref() == Some(id)
}

fn is_action_target(event: &lkjstr_protocol::NostrEvent, id: &str) -> bool {
    lkjstr_protocol::event_references(event)
        .iter()
        .any(|reference| reference.id == id)
}

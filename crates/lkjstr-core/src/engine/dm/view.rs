//! Private view identities and inert display data are decided before the UI boundary.
use super::*;
use crate::{content::Segment, engine::Engine};
use serde_json::{Value, json};

impl Query {
    /// Canonical participant sets allow an empty conversation without UI hashing.
    pub fn normalized(&self) -> Result<Self, &'static str> {
        if !lkjstr_protocol::is_pubkey(&self.account)
            || self
                .conversation
                .as_deref()
                .is_some_and(|v| !lkjstr_protocol::is_event_id(v))
            || self
                .before
                .as_deref()
                .is_some_and(|v| !lkjstr_protocol::is_event_id(v))
        {
            return Err("rejected");
        }
        let mut query = self.clone();
        if let Some(people) = &self.participants {
            if people.len() > MAX_PARTICIPANTS
                || people.iter().any(|p| !lkjstr_protocol::is_pubkey(p))
            {
                return Err("rejected");
            }
            let mut people: BTreeSet<_> = people.iter().cloned().collect();
            people.insert(self.account.clone());
            if people.len() > MAX_PARTICIPANTS || people.len() < 2 {
                return Err("rejected");
            }
            let room = conversation(&people);
            if self.conversation.as_ref().is_some_and(|id| *id != room) {
                return Err("rejected");
            }
            query.conversation = Some(room);
            query.participants = Some(people.into_iter().collect());
        }
        Ok(query)
    }
}

impl Inbox {
    pub fn participants(&self, query: &Query) -> BTreeSet<String> {
        query
            .participants
            .as_ref()
            .map(|people| people.iter().cloned().collect())
            .or_else(|| {
                self.messages
                    .iter()
                    .find(|((a, _), message)| {
                        a == &query.account
                            && query.conversation.as_ref() == Some(&message.conversation)
                    })
                    .map(|(_, message)| message.participants.iter().cloned().collect())
            })
            .unwrap_or_default()
    }
}

impl Engine {
    pub fn dm_metadata_revision(&self) -> u64 {
        self.store.snapshot_revision()
    }
    pub fn dm_blocked(&self, inbox: &Inbox, query: &Query) -> Option<Vec<String>> {
        if query.unread_only {
            return None;
        }
        let participants = inbox.participants(query);
        if participants.is_empty() {
            return None;
        }
        Some(
            participants
                .into_iter()
                .filter(|person| {
                    let known = self.store.replaceable(person, 10050).is_some()
                        || self.network.list_loaded(&self.store, person, 10050);
                    known
                        && routing::inboxes(&self.store, person)
                            .map_or(true, |relays| relays.is_empty())
                })
                .collect(),
        )
    }
    /// Profiles remain public data; private bodies never enter Store or public row caches.
    pub fn decorate_dm_snapshot(&self, inbox: &Inbox, query: &Query, snapshot: &mut Snapshot) {
        if query.unread_only {
            return;
        }
        let participants = inbox.participants(query);
        let mut people = participants.clone();
        for room in &snapshot.conversations {
            people.extend(room.participants.iter().cloned());
        }
        for message in snapshot
            .messages
            .iter()
            .chain(snapshot.conversations.iter().map(|c| &c.last))
        {
            people.insert(message.author.clone());
            if let Some(reply) = &message.reply {
                people.insert(reply.author.clone());
            }
        }
        snapshot.people = Some(
            people
                .into_iter()
                .take(2048)
                .map(|key| {
                    crate::engine::wire::note::author(&crate::engine::rows::author(
                        &self.store,
                        &key,
                    ))
                })
                .collect(),
        );
        snapshot.blocked = self.dm_blocked(inbox, query);
        for message in snapshot
            .messages
            .iter_mut()
            .chain(snapshot.conversations.iter_mut().map(|c| &mut c.last))
        {
            for segment in message.segments.as_mut().into_iter().flatten() {
                if segment["k"] == "mention"
                    && let Some(key) = segment["pubkey"].as_str()
                {
                    let author = crate::engine::rows::author(&self.store, key);
                    if author.name != key {
                        segment["name"] = json!(author.name);
                    }
                }
            }
        }
    }
}

pub(super) fn segments(text: &str, tags: &[Vec<String>]) -> Vec<Value> {
    let emoji = tags
        .iter()
        .filter_map(|tag| lkjstr_protocol::custom_emoji_tag(tag))
        .take(256)
        .map(|e| (e.shortcode, e.url))
        .collect::<Vec<_>>();
    crate::content::segments(text, &emoji)
        .into_iter()
        .map(|part| match part {
            Segment::Text(text) => json!({"k":"text","text":text}),
            Segment::Link(url)
            | Segment::Image(url)
            | Segment::Video(url)
            | Segment::Audio(url) => json!({"k":"link","text":url,"url":url}),
            Segment::Mention(key) => json!({"k":"mention","pubkey":key,
            "name":lkjstr_protocol::encode_npub(&key).unwrap_or_default()}),
            Segment::Quote { id, .. } => {
                let reference = lkjstr_protocol::encode_note(&id).unwrap_or_default();
                json!({"k":"ref","bech32":reference,"text":format!("nostr:{reference}")})
            }
            Segment::Hashtag(tag) => json!({"k":"hashtag","tag":tag}),
            Segment::Emoji { code, url } => json!({"k":"emoji","code":code,"url":url}),
        })
        .collect()
}

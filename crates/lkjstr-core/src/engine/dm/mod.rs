//! Account-isolated, bounded private messages; plaintext is never in the event store.
mod projection;
pub mod routing;
pub mod types;
use lkjstr_nips::{
    dm,
    event::{Event, Rumor, unique},
};
use std::collections::{BTreeMap, BTreeSet};
pub use types::{Conversation, Draft, Mark, Message, Query, Snapshot};
pub const MAX_MESSAGES: usize = 8000;
pub const MAX_TEXT: usize = 16 * 1024;
pub const MAX_PARTICIPANTS: usize = 32;

/// Only read marks serialize. The at-most-8000 decrypted bodies are session memory.
#[derive(Default)]
pub struct Inbox {
    messages: BTreeMap<(String, String), Message>,
    pub marks: BTreeMap<String, Mark>, // <=4096 account/conversation pairs
    pub revision: u64,
}
pub fn conversation(participants: &BTreeSet<String>) -> String {
    lkjstr_protocol::upload::hash(
        participants
            .iter()
            .cloned()
            .collect::<Vec<_>>()
            .join(":")
            .as_bytes(),
    )
}
pub fn draft(account: &str, input: &Draft, now: u64) -> Result<Rumor, &'static str> {
    if input.text.is_empty()
        || input.text.len() > MAX_TEXT
        || input.recipients.is_empty()
        || input.recipients.len() >= MAX_PARTICIPANTS
        || input.subject.as_ref().is_some_and(|s| s.len() > 256)
    {
        return Err("rejected");
    }
    dm::message(
        account.into(),
        &input.recipients,
        &input.text,
        now,
        input.reply_to.as_deref(),
        input.subject.as_deref(),
    )
    .map_err(|_| "rejected")
}
impl Inbox {
    /// Accept only a rumor authenticated by the signature-bound seal pipeline.
    pub fn insert(&mut self, account: &str, rumor: Rumor) -> Result<bool, &'static str> {
        let peers = dm::participants(&rumor).map_err(|_| "rejected")?;
        if !peers.contains(account)
            || peers.len() > MAX_PARTICIPANTS
            || rumor.data.content.len() > MAX_TEXT
        {
            return Err("rejected");
        }
        let message = Message {
            id: rumor.id,
            conversation: conversation(&peers),
            author: rumor.data.pubkey,
            participants: peers.into_iter().collect(),
            at: rumor.data.created_at.saturating_mul(1000),
            text: rumor.data.content,
            reply_to: unique(&rumor.data.tags, "e")
                .map_err(|_| "rejected")?
                .map(str::to_owned),
            subject: unique(&rumor.data.tags, "subject")
                .map_err(|_| "rejected")?
                .map(str::to_owned),
            legacy: false,
            unread: false,
        };
        self.insert_message(account, message)
    }
    /// Legacy author/recipient and signature are checked before accepting decrypted content.
    pub fn insert_legacy(
        &mut self,
        account: &str,
        event: &Event,
        text: String,
    ) -> Result<bool, &'static str> {
        let peer = lkjstr_nips::nip04::peer(event, account).map_err(|_| "rejected")?;
        if text.len() > MAX_TEXT {
            return Err("too-large");
        }
        let peers = BTreeSet::from([account.to_owned(), peer]);
        let message = Message {
            id: event.id.clone(),
            conversation: conversation(&peers),
            author: event.data.pubkey.clone(),
            participants: peers.into_iter().collect(),
            at: event.data.created_at.saturating_mul(1000),
            text,
            reply_to: unique(&event.data.tags, "e")
                .map_err(|_| "rejected")?
                .map(str::to_owned),
            subject: None,
            legacy: true,
            unread: false,
        };
        self.insert_message(account, message)
    }
    fn insert_message(&mut self, account: &str, message: Message) -> Result<bool, &'static str> {
        let key = (account.to_owned(), message.id.clone());
        if self.messages.contains_key(&key) {
            return Ok(false);
        }
        if self.messages.len() >= MAX_MESSAGES
            && let Some(old) = self
                .messages
                .iter()
                .min_by_key(|(_, m)| (m.at, &m.id))
                .map(|(k, _)| k.clone())
        {
            self.messages.remove(&old);
        }
        self.messages.insert(key, message);
        self.revision = self.revision.wrapping_add(1);
        Ok(true)
    }
    pub fn seen(&mut self, account: &str, room: &str) -> Result<(), &'static str> {
        let key = format!("{account}:{room}");
        if self.marks.len() >= 4096 && !self.marks.contains_key(&key) {
            return Err("too-large");
        }
        let rows: Vec<_> = self
            .messages
            .iter()
            .filter(|((a, _), m)| a == account && m.conversation == room)
            .map(|(_, m)| m)
            .collect();
        let at = rows.iter().map(|m| m.at).max().ok_or("not-found")?;
        let ids = rows
            .into_iter()
            .filter(|m| m.at == at)
            .map(|m| m.id.clone())
            .collect();
        self.marks.insert(key, Mark { at, ids });
        self.revision = self.revision.wrapping_add(1);
        Ok(())
    }
    pub fn retain_messages(&mut self, accounts: &BTreeSet<String>) {
        let old = self.messages.len();
        self.messages.retain(|(a, _), _| accounts.contains(a));
        if self.messages.len() != old {
            self.revision = self.revision.wrapping_add(1);
        }
    }
    pub fn retain_accounts(&mut self, accounts: &BTreeSet<String>) {
        let before = (self.messages.len(), self.marks.len());
        self.messages.retain(|(a, _), _| accounts.contains(a));
        self.marks.retain(|key, _| {
            key.split_once(':')
                .is_some_and(|(a, _)| accounts.contains(a))
        });
        if before != (self.messages.len(), self.marks.len()) {
            self.revision = self.revision.wrapping_add(1);
        }
    }
    pub fn restore_marks(&mut self, raw: &str) -> Result<(), &'static str> {
        if raw.len() > 4 * 1024 * 1024 {
            return Err("too-large");
        }
        let marks: BTreeMap<String, Mark> = serde_json::from_str(raw).map_err(|_| "rejected")?;
        if marks.len() > 4096
            || marks.values().any(|m| m.ids.len() > MAX_MESSAGES)
            || marks.keys().any(|k| {
                !k.split_once(':').is_some_and(|(a, c)| {
                    lkjstr_protocol::is_pubkey(a) && lkjstr_protocol::is_event_id(c)
                })
            })
        {
            return Err("rejected");
        }
        self.marks = marks;
        self.revision = self.revision.wrapping_add(1);
        Ok(())
    }
}

use super::{
    AtomRef, Id, OrderKey, Tags, accounting::Charge, decode_id, encode_id, hex, identity::decode,
};
use lkjstr_protocol::NostrEvent;
use std::{borrow::Cow, sync::Arc};

#[derive(Debug)]
pub struct CompactEvent {
    pub order: OrderKey,
    pub author: AtomRef,
    pub kind: u64,
    pub sig: [u8; 64],
    pub content: Box<str>,
    pub tags: Tags,
    pub wire_bytes: usize,
    pub expires_at: Option<u64>,
    pub(super) charge: Charge,
    pub(super) attributed_bytes: usize,
}
impl CompactEvent {
    pub fn id(&self) -> &Id {
        &self.order.1
    }
    pub fn pubkey(&self) -> &Id {
        match self.author.key() {
            Some(key) => key,
            None => unreachable!("compact authors are constructed from binary keys"),
        }
    }
    pub fn id_hex(&self) -> String {
        encode_id(self.id())
    }
    pub fn pubkey_hex(&self) -> String {
        encode_id(self.pubkey())
    }
    pub fn to_nostr(&self) -> NostrEvent {
        NostrEvent {
            id: self.id_hex(),
            pubkey: self.pubkey_hex(),
            created_at: self.order.0,
            kind: self.kind,
            tags: self.tags.to_vec(),
            content: self.content.to_string(),
            sig: hex(&self.sig),
        }
    }
    /// Materialization belongs to the caller; no decoded copy is cached here.
    pub fn materialize(&self) -> Arc<NostrEvent> {
        Arc::new(self.to_nostr())
    }
    pub fn tag_values<'a>(&'a self, name: &'a str) -> impl Iterator<Item = Cow<'a, str>> {
        self.tags.values(name)
    }
    pub fn tag_ids<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Id> {
        self.tags.ids(name)
    }
    /// Address identity follows the first d tag, including missing/empty values.
    pub fn identifier(&self) -> Option<Cow<'_, str>> {
        lkjstr_protocol::is_addressable_kind(self.kind).then(|| {
            self.tags
                .iter()
                .find(|tag| tag.first().is_some_and(|field| field.matches("d")))
                .and_then(|tag| tag.get(1))
                .map_or(Cow::Borrowed(""), |field| field.text())
        })
    }
    /// Full equality preserves the existing verified-duplicate boundary.
    pub fn matches(&self, event: &NostrEvent) -> bool {
        self.order.0 == event.created_at
            && self.kind == event.kind
            && self.content.as_ref() == event.content
            && decode_id(&event.id).as_ref() == Some(self.id())
            && decode_id(&event.pubkey).as_ref() == Some(self.pubkey())
            && decode::<64>(&event.sig).as_ref() == Some(&self.sig)
            && self.tags.matches(&event.tags)
    }
    /// Exclusive payload allocation: Arc, content and flat tag arrays.
    pub fn owned_bytes(&self) -> usize {
        self.charge.bytes()
    }
    /// Share dictionary atoms across their resident field references. Fixed
    /// cache evidence is not an event body and must not penalize every survivor.
    pub fn resident_bytes(&self) -> usize {
        let share = |atom: &AtomRef| {
            atom.managed_bytes()
                .div_ceil(Arc::strong_count(atom).saturating_sub(1).max(1))
        };
        self.owned_bytes()
            + share(&self.author)
            + self.tags.iter().flatten().map(share).sum::<usize>()
    }
    /// Conservative per-event charge includes every referenced symbol. Shared
    /// and repeated symbols can appear in more than one such charge; use Pool's
    /// ledger for the aggregate, not a sum of these per-event upper bounds.
    pub fn managed_bytes(&self) -> usize {
        self.attributed_bytes
    }
}

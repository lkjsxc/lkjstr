//! A public mute selection is a separate, revocable count basis, never a deletion.
use super::*;
use crate::engine::Engine;
use serde::Serialize;
use sha2::{Digest, Sha256};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionEvidence {
    account: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_at: Option<String>,
    token: String,
    pub committed: bool,
}
impl ReadContexts {
    pub(crate) fn policy_committed(&mut self, store: &Store, author: &str, id: &str) {
        if !store
            .replaceable(author, 10000)
            .is_some_and(|event| event.id == id)
        {
            return;
        }
        self.clock = self.clock.saturating_add(1);
        self.policies.insert(author.into(), (id.into(), self.clock));
        while self.policies.len() > 128 {
            let Some(old) = self
                .policies
                .iter()
                .min_by_key(|(author, (_, at))| (*at, *author))
                .map(|(author, _)| author.clone())
            else {
                break;
            };
            self.policies.remove(&old);
        }
    }
    pub fn selection(
        &self,
        store: &Store,
        context: &ContextEvidence,
        account: &str,
    ) -> Option<SelectionEvidence> {
        let event = store.replaceable(account, 10000);
        let id = event.as_ref().map(|event| event.id.clone());
        let created_at = event.as_ref().map(|event| event.created_at.to_string());
        let committed = id.as_ref().is_none_or(|id| {
            self.policies
                .get(account)
                .is_some_and(|(known, _)| known == id)
        });
        let bytes = serde_json::to_vec(&(
            "lkjstr-read-selection-1",
            &context.token,
            account,
            &id,
            &created_at,
        ))
        .ok()?;
        Some(SelectionEvidence {
            account: account.into(),
            id,
            created_at,
            token: lkjstr_protocol::bytes_to_hex(&Sha256::digest(bytes)),
            committed,
        })
    }
}
impl Engine {
    /// Call only after the event transaction committed. A late old ack cannot
    /// bless a newer, still-pending policy that changed the rendered reply count.
    pub fn public_policy_leases_committed(&mut self, events: &[crate::store::compact::Lease]) {
        for event in events.iter().filter(|event| event.kind == 10000) {
            self.read_contexts
                .policy_committed(&self.store, &event.pubkey_hex(), &event.id_hex());
        }
    }
    pub fn public_policy_committed(&mut self, events: &[NostrEvent]) {
        for event in events.iter().filter(|event| event.kind == 10000) {
            self.read_contexts
                .policy_committed(&self.store, &event.pubkey, &event.id);
        }
    }
    pub fn forget_public_policy(&mut self, account: &str) {
        self.read_contexts.policies.remove(account);
    }
}

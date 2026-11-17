//! Synchronous revocation of decrypted list policy and derived row snapshots.
use super::{Engine, protocol::Output};
use std::collections::BTreeSet;
impl Engine {
    /// Mute row keys can contain private words; ordinary event IDs remain opaque anchors.
    pub(super) fn accepts_private_anchor(&self, account: Option<&str>, key: &str) -> bool {
        let Some(rest) = key.strip_prefix("mute:") else {
            return true;
        };
        let Some((kind, value)) = rest.split_once(':') else {
            return false;
        };
        if !matches!(kind, "p" | "word" | "t" | "e") {
            return false;
        }
        let Some(event) = account.and_then(|a| self.store.replaceable(a, 10000)) else {
            return false;
        };
        event
            .tags
            .iter()
            .chain(self.private_lists.get(&event.id).into_iter().flatten())
            .any(|tag| {
                tag.first().is_some_and(|k| k == kind) && tag.get(1).is_some_and(|v| v == value)
            })
    }

    /// Returns replacement row snapshots for every open view, including hidden ones.
    /// The host must route these before acknowledging a successful account mutation.
    /// Lost signer access forces replacement even if status already cleared private policy.
    pub fn retain_private_accounts(
        &mut self,
        accounts: &BTreeSet<String>,
        now: u64,
        authority_decreased: bool,
    ) -> Option<Vec<Output>> {
        let before = self.private_lists.len();
        self.private_lists.retain(|id, _| {
            self.store
                .get(id)
                .is_some_and(|event| accounts.contains(&event.pubkey))
        });
        if !authority_decreased && self.private_lists.len() == before {
            return None;
        }
        self.revoke_local_reads(now);
        let revoked = self
            .views
            .iter()
            .filter(|(_, view)| {
                view.anchor.as_deref().is_some_and(|key| {
                    !self.accepts_private_anchor(view.query.account.as_deref(), key)
                })
            })
            .map(|(sub, _)| sub.clone())
            .collect::<Vec<_>>();
        for sub in revoked {
            if let Some(view) = self.views.get_mut(&sub) {
                view.anchor = None;
                view.before = 0;
            }
        }
        // No already-queued row payload may restore a projection from the revoked map.
        self.outgoing.retain(|out| {
            !matches!(
                out,
                Output::Rows { .. } | Output::Patch { .. } | Output::Fresh { .. }
            )
        });
        self.replan(now);
        let start = self.outgoing.len();
        let subs = self.views.keys().cloned().collect::<Vec<_>>();
        for sub in subs {
            self.render(&sub, true);
        }
        Some(self.outgoing.split_off(start))
    }
}

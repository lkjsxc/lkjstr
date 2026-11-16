use super::super::Failure;
use super::{Jobs, Owner};
impl Jobs {
    /// A close is also a cancellation of an explicit invoice with the same owner.
    pub fn close(&mut self, owner: &Owner) {
        self.queries.remove(owner);
        self.replies.remove(owner);
        if let Some(completed) = self.outcomes.get_mut(owner) {
            completed.fail(Failure::Cancelled);
        }
        if let Some(token) = self.owners.get(owner).copied() {
            self.finish(token, Err(Failure::Cancelled));
        }
        self.changed = true;
    }
    pub fn detach(&mut self, client: u64) {
        let owners: Vec<_> = self
            .queries
            .keys()
            .chain(self.owners.keys())
            .filter(|o| o.client == client)
            .cloned()
            .collect();
        for owner in owners {
            self.close(&owner);
        }
        self.replies.retain(|o, _| o.client != client);
        self.outcomes.retain(|o, _| o.client != client);
    }
    /// Account replacement, removal, lock and unlock revoke existing work. Token
    /// serials never reset, so removing then re-adding a key cannot revive a callback.
    pub fn account_changed(&mut self, account: &str) {
        // Completion retains ownership until the terminal result is emitted.
        // Revoke queued payloads synchronously before an account change is acknowledged.
        for completed in self.outcomes.values_mut().filter(|c| c.account == account) {
            if completed.result.is_ok() {
                completed.fail(Failure::SignerMissing);
            }
        }
        let tokens: Vec<_> = self
            .invoices
            .iter()
            .filter(|(_, j)| j.account == account)
            .map(|(t, _)| *t)
            .collect();
        for token in tokens {
            self.finish(token, Err(Failure::SignerMissing));
        }
    }
    pub fn fail_targets(
        &mut self,
        missing: &std::collections::BTreeMap<super::super::Target, Failure>,
    ) {
        let failed: Vec<_> = self
            .invoices
            .iter()
            .filter_map(|(token, j)| missing.get(&j.input.target).map(|e| (*token, *e)))
            .collect();
        for (token, error) in failed {
            self.finish(token, Err(error));
        }
    }
    pub fn fail_invoice(&mut self, token: u64, error: Failure) {
        self.finish(token, Err(error));
    }
    pub fn expire(&mut self, now: u64) {
        let expired: Vec<_> = self
            .invoices
            .iter()
            .filter(|(_, j)| now >= j.deadline)
            .map(|(t, _)| *t)
            .collect();
        for token in expired {
            self.finish(token, Err(Failure::Network));
        }
    }
}

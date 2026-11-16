use super::super::{Phase, Providers, Target, TrustedReceipt};
use super::{Receipts, Total};
use crate::store::Store;

impl Receipts {
    /// The canonical oldest receipt wins independently of arrival order, including
    /// duplicate invoices that point at different targets.
    pub fn get<'a>(&'a self, store: &Store, id: &str) -> Option<&'a TrustedReceipt> {
        let checked = self.entries.get(id)?.checked.as_ref()?;
        let value = checked.result.as_ref().ok()?;
        if !value.retained(store) {
            return None;
        }
        let first = self.groups.get(&value.payment_key())?.first()?;
        (first.1 == value.id).then_some(value)
    }
    /// Includes noncanonical duplicate verdicts so Seen can acknowledge a logical
    /// payment even when the retained canonical raw id changes later.
    pub fn logical_id(&self, store: &Store, id: &str) -> Option<String> {
        let value = self
            .entries
            .get(id)?
            .checked
            .as_ref()?
            .result
            .as_ref()
            .ok()?;
        value.retained(store).then(|| {
            format!(
                "{}:{}:{}",
                value.provider, value.recipient, value.payment_hash
            )
        })
    }
    pub fn rejected(&self, id: &str) -> bool {
        self.entries
            .get(id)
            .and_then(|entry| entry.checked.as_ref())
            .is_some_and(|checked| matches!(checked.result, Err(super::super::Failure::Rejected)))
    }
    pub fn total(&self, store: &Store, providers: &Providers, target: &Target, now: u64) -> Total {
        let mut amount = 0_u128;
        let mut receipts = 0;
        let mut unverified = 0;
        let mut phase = Phase::Ready;
        for id in self.index.get(target).into_iter().flat_map(|i| &i.ids) {
            if let Some(value) = self.get(store, id) {
                amount += u128::from(value.amount_msat);
                receipts += 1;
                continue;
            }
            if let Some(status) = self.pending_phase(store, providers, id, now) {
                unverified += 1;
                phase = combine(phase, status);
            }
        }
        Total::from_sum(amount, receipts, unverified, phase)
    }
}
pub(super) fn combine(left: Phase, right: Phase) -> Phase {
    for phase in [Phase::Loading, Phase::Failed, Phase::Unsupported] {
        if left == phase || right == phase {
            return phase;
        }
    }
    Phase::Ready
}

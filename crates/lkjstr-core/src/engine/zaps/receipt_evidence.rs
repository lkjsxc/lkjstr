use super::super::{Failure, Phase, Providers};
use super::{Entry, Receipts, read::combine};
use crate::store::Store;
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct Evidence {
    pub phase: Phase,
    pub unverified: usize,
    #[serde(rename = "readLimited", skip_serializing_if = "is_false")]
    pub read_limited: bool,
}
impl Receipts {
    /// A filtered notification view may contain no trusted rows while still
    /// retaining unresolved receipt claims. That is not an empty verified history.
    pub fn evidence<'a>(
        &self,
        store: &Store,
        providers: &Providers,
        ids: impl IntoIterator<Item = &'a str>,
        now: u64,
    ) -> Evidence {
        let mut evidence = Evidence {
            phase: Phase::Ready,
            unverified: 0,
            read_limited: false,
        };
        for id in ids {
            if let Some(phase) = self.pending_phase(store, providers, id, now) {
                evidence.unverified += 1;
                evidence.phase = combine(evidence.phase, phase);
            }
        }
        evidence
    }
    pub(super) fn pending_phase(
        &self,
        store: &Store,
        providers: &Providers,
        id: &str,
        now: u64,
    ) -> Option<Phase> {
        let raw = store.get(id)?;
        if raw.kind != 9735 {
            return None;
        }
        let unseen;
        let entry = match self.entries.get(id) {
            Some(entry) => entry,
            None => {
                unseen = Entry::new(&raw);
                &unseen
            }
        };
        let recipient = entry.recipient.as_deref()?;
        let checked = entry.checked.as_ref();
        // Canonical and duplicate successful receipts are both resolved. An
        // immutable malformed claim is excluded rather than labelled a payment.
        if checked.is_some_and(|c| c.result.is_ok() || matches!(c.result, Err(Failure::Rejected)))
            && entry.queued.is_none()
        {
            return None;
        }
        let phase = providers.status(store, recipient, now).0;
        Some(if phase == Phase::Ready {
            checked
                .and_then(|c| c.result.as_ref().err())
                .map_or(Phase::Loading, |error| {
                    if matches!(error, Failure::NotFound | Failure::Stale | Failure::Expired) {
                        Phase::Loading
                    } else {
                        error.phase()
                    }
                })
        } else {
            phase
        })
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

//! Legacy cache rows gain receipts only after their original signature checks.
use super::{Record, Restored};
use lkjstr_protocol::{VerificationResult, verify_event};
const MAX_ROW_BYTES: usize = 1024 * 1024;

fn checked(record: &Record, eligible: impl Fn(u64) -> bool) -> Option<Record> {
    if record.raw.len() > MAX_ROW_BYTES {
        return None;
    }
    let restored = record.restore().ok()?;
    let (event, verified) = match restored {
        Restored::Verified(event) => (event, true),
        Restored::Verify(event) => (event, false),
    };
    if !eligible(event.kind)
        || (!verified && !matches!(verify_event(&event), VerificationResult::Ok(_)))
    {
        return None;
    }
    Record::verified(&event).ok()
}
pub fn validate_metadata(record: &Record) -> Option<Record> {
    checked(record, |kind| {
        kind == 5 || lkjstr_protocol::is_replaceable_kind(kind)
    })
}
pub fn validate_public_reference(record: &Record) -> Option<Record> {
    // Message wrappers and signer RPC records cannot be admitted by a public
    // pre-unlock snapshot hint, even when an event ID is known to the frontend.
    checked(record, |kind| {
        matches!(kind, 0 | 1 | 5 | 6 | 7 | 16 | 40 | 41 | 42 | 9735 | 30023)
    })
}

//! Bounded LNURL discovery, NIP-57 payment intents and provider-authorized receipts.
//! Hosts perform HTTP/signing; these decisions have explicit time and no I/O.
mod discovery;
mod endpoint;
mod jobs;
mod provider;
mod quote;
mod read_state;
mod receipt;
mod receipt_cache;
mod receipt_list;
mod request;
mod sender;
mod state;
mod targets;
mod url;
pub use discovery::{Discovery, Providers, Work};
pub use endpoint::{Binding, binding};
pub use jobs::{
    Coverage, InvoiceBatch, InvoiceWork, Jobs, Owner, QueryReply, QuoteInput, ReceiptInput,
    ReceiptView,
};
pub use provider::{Provider, provider};
pub use quote::{InvoiceInput, Quote, QuoteRecipient, invoice_plan, quote};
pub use read_state::{ReadSnapshot, ReadState};
pub use receipt::{IdentityProof, TrustedReceipt, receipt};
pub use receipt_cache::{Evidence, MAX_HISTORICAL_IDENTITIES, Receipts, Total};
pub use receipt_list::{ReceiptCursor, ReceiptPage, ReceiptRow, Verification};
pub use request::{IntentState, InvoiceIntent, PreparedRequest, SuccessAction, invoice, prepare};
pub use sender::Sender;
use serde::{Deserialize, Serialize};
pub use state::{Effects, State};
pub use targets::{Recipient, TargetPlan, allocations, target};

/// Largest exact integer carried by the existing JavaScript protocol.
pub const MAX_MSAT: u64 = (1 << 53) - 1;
/// Every request, quote and authenticated split has a finite recipient bound.
pub const MAX_RECIPIENTS: usize = 32;
pub const PROVIDER_TTL: u64 = 10 * 60;
pub const FAILURE_TTL: u64 = 60;
pub const MAX_RESPONSE_BYTES: usize = 64 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(tag = "k", rename_all = "lowercase")]
pub enum Target {
    Event { id: String },
    Profile { pubkey: String },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Failure {
    NotFound,
    Unsupported,
    Rejected,
    TooLarge,
    Network,
    Untrusted,
    Stale,
    Expired,
    Cancelled,
    SignerMissing,
    SignerRefused,
    SignerTimeout,
}
pub type Result<T> = std::result::Result<T, Failure>;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Loading,
    Ready,
    Failed,
    Unsupported,
}
impl Failure {
    pub fn phase(self) -> Phase {
        if self == Self::Unsupported {
            Phase::Unsupported
        } else {
            Phase::Failed
        }
    }
}

fn event(raw: &lkjstr_protocol::NostrEvent) -> Result<lkjstr_nips::event::Event> {
    let json = serde_json::to_string(raw).map_err(|_| Failure::Rejected)?;
    lkjstr_nips::event::Event::parse(&json, MAX_RESPONSE_BYTES).map_err(|error| {
        if error == lkjstr_nips::Error::Size {
            Failure::TooLarge
        } else {
            Failure::Rejected
        }
    })
}

/// Core policy uses seconds; every display timestamp crosses the wire in milliseconds.
fn millis<S: serde::Serializer>(
    seconds: &u64,
    serializer: S,
) -> std::result::Result<S::Ok, S::Error> {
    let millis = seconds
        .checked_mul(1000)
        .filter(|n| *n <= MAX_MSAT)
        .ok_or_else(|| serde::ser::Error::custom("timestamp-out-of-range"))?;
    serializer.serialize_u64(millis)
}

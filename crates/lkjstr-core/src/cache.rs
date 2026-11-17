//! Browser-owned verification receipts bind exact stored public event bytes.
//! Only the verified ingest/publication paths may mint a receipt. This is a
//! corruption/version boundary, not authentication against same-origin code.
use lkjstr_protocol::{NostrEvent, compact};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[path = "cache_metadata.rs"]
mod metadata;
pub use metadata::{METADATA_BYTES, METADATA_EVENTS, METADATA_KEY, merge_metadata, metadata_rows};

const RECEIPT: &str = "lkjstr-verified-1:";
pub const VERIFY_SOURCE: &str = "cache-verify";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Record {
    pub id: String,
    pub created_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<u64>,
    pub raw: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt: Option<String>,
}

pub enum Restored {
    Verified(NostrEvent),
    Verify(NostrEvent),
}

impl Record {
    /// The caller has already checked this event's hash and signature.
    pub fn verified(event: &NostrEvent) -> Result<Self, serde_json::Error> {
        let raw = compact::encode(event)?;
        let receipt = Some(receipt(&raw));
        Ok(Self {
            id: event.id.clone(),
            created_at: event.created_at,
            kind: Some(event.kind),
            raw,
            receipt,
        })
    }

    /// Old rows and mismatched receipts still need ordinary signature checking.
    pub fn restore(&self) -> Result<Restored, serde_json::Error> {
        let event = compact::decode(&self.raw)?;
        if self.id == event.id
            && self.created_at == event.created_at
            && self.kind == Some(event.kind)
            && self.receipt.as_deref() == Some(receipt(&self.raw).as_str())
        {
            Ok(Restored::Verified(event))
        } else {
            Ok(Restored::Verify(event))
        }
    }

    pub fn is_checkpoint(&self) -> bool {
        self.kind
            .is_some_and(|kind| kind == 5 || lkjstr_protocol::is_replaceable_kind(kind))
    }
}

fn receipt(raw: &str) -> String {
    format!(
        "{RECEIPT}{}",
        lkjstr_protocol::bytes_to_hex(&Sha256::digest(raw.as_bytes()))
    )
}

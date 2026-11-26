//! Browser-owned verification receipts bind exact stored public event bytes.
//! Only the verified ingest/publication paths may mint a receipt. This is a
//! corruption/version boundary, not authentication against same-origin code.
use lkjstr_protocol::{NostrEvent, compact};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[path = "cache_context.rs"]
pub mod context;
#[path = "cache_durable.rs"]
pub mod durable;
#[path = "cache_metadata.rs"]
mod metadata;
#[path = "cache_validate.rs"]
mod validate;
pub use validate::{validate_metadata, validate_public_reference};
#[path = "cache_zaps.rs"]
pub mod zaps;
pub use metadata::{
    METADATA_BYTES, METADATA_EVENTS, METADATA_KEY, MetadataAccess, MetadataCommit, Required,
    merge_metadata, merge_metadata_with_access, metadata_inline, metadata_references,
    metadata_rows, recover_metadata, resolve_metadata,
};

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
            && self
                .receipt
                .as_deref()
                .is_some_and(|stored| matches_receipt(&self.raw, stored))
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

// Compare the exact lowercase receipt encoding without allocating an expected String.
fn matches_receipt(raw: &str, stored: &str) -> bool {
    let Some(encoded) = stored
        .strip_prefix(RECEIPT)
        .filter(|value| value.len() == 64)
    else {
        return false;
    };
    const HEX: &[u8] = b"0123456789abcdef";
    Sha256::digest(raw.as_bytes())
        .iter()
        .zip(encoded.as_bytes().as_chunks::<2>().0)
        .all(|(byte, pair)| {
            pair[0] == HEX[(byte >> 4) as usize] && pair[1] == HEX[(byte & 15) as usize]
        })
}

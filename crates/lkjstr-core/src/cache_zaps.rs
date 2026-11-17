//! Historical provider authorization is cached only after full receipt validation.
use super::{Record, Restored};
use crate::engine::zaps::{Failure, Result as ZapResult, Target, TrustedReceipt};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "decision", rename_all = "lowercase")]
pub enum Decision {
    Accepted { value: Box<TrustedReceipt> },
    Rejected,
    Unsupported,
    Pending,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReceiptRecord {
    pub id: String,
    raw: String,
    pub decision: Decision,
    pub digest: String,
}
impl ReceiptRecord {
    pub(crate) fn new(row: &Record, decision: Option<&ZapResult<TrustedReceipt>>) -> Option<Self> {
        let decision = match decision {
            Some(Ok(value)) => Decision::Accepted {
                value: Box::new(value.clone()),
            },
            Some(Err(Failure::Rejected)) => Decision::Rejected,
            Some(Err(Failure::Unsupported)) => Decision::Unsupported,
            _ => Decision::Pending,
        };
        let raw = row.receipt.clone()?;
        let digest = digest(&row.id, &raw, &decision).ok()?;
        Some(Self {
            id: row.id.clone(),
            raw,
            decision,
            digest,
        })
    }
    /// This corruption receipt binds the prior validation verdict to the exact
    /// checked raw bytes. It does not authorize fresh receipts or provider keys.
    pub fn checked(&self, row: &Record) -> Result<(), &'static str> {
        let Ok(Restored::Verified(event)) = row.restore() else {
            return Err("unverified zap context record");
        };
        if self.id != row.id
            || event.kind != 9735
            || row.receipt.as_ref() != Some(&self.raw)
            || self.digest != digest(&self.id, &self.raw, &self.decision)?
        {
            return Err("invalid zap context receipt");
        }
        if let Decision::Accepted { value } = &self.decision {
            let unique = |name| lkjstr_nips::event::unique(&event.tags, name).ok().flatten();
            let target = unique("e")
                .map(|id| Target::Event { id: id.into() })
                .or_else(|| {
                    unique("p").map(|pubkey| Target::Profile {
                        pubkey: pubkey.into(),
                    })
                });
            if value.id != event.id
                || value.provider != event.pubkey
                || unique("p") != Some(value.recipient.as_str())
                || target.as_ref() != Some(&value.target)
                || value.created_at != event.created_at
                || value.amount_msat == 0
                || value.amount_msat > crate::engine::zaps::MAX_MSAT
                || value.proof.provider != value.provider
                || value.proof.recipient != value.recipient
                || !lkjstr_protocol::is_event_id(&value.proof.profile)
                || !lkjstr_protocol::is_event_id(&value.payment_hash)
                || value.proof.endpoint.len() > 2048
                || !url::Url::parse(&value.proof.endpoint).is_ok_and(|url| url.scheme() == "https")
            {
                return Err("invalid historical zap authorization");
            }
        }
        Ok(())
    }
    pub fn pending(&self) -> bool {
        matches!(self.decision, Decision::Pending)
    }
    pub(crate) fn verdict(&self) -> Option<ZapResult<TrustedReceipt>> {
        match &self.decision {
            Decision::Accepted { value } => Some(Ok(*value.clone())),
            Decision::Rejected => Some(Err(Failure::Rejected)),
            Decision::Unsupported => Some(Err(Failure::Unsupported)),
            Decision::Pending => None,
        }
    }
}
fn digest(id: &str, raw: &str, decision: &Decision) -> Result<String, &'static str> {
    let bytes = serde_json::to_vec(&("lkjstr-zap-context-1", id, raw, decision))
        .map_err(|_| "zap context encoding failed")?;
    Ok(lkjstr_protocol::bytes_to_hex(&Sha256::digest(bytes)))
}

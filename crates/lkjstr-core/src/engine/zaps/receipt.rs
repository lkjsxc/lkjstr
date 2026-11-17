//! A receipt's sender and value are exposed only after provider authorization.
use super::{Failure, Provider, Result, Target, binding, target};
use crate::store::Store;
use lkjstr_nips::{event::unique, lnurl, zap::validate_receipt};
use lkjstr_protocol::NostrEvent;
use std::sync::Arc;

/// Compact historical authorization; no provider description or callback is copied.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize)]
pub struct IdentityProof {
    pub recipient: String,
    pub provider: String,
    pub profile: String,
    pub endpoint: String,
}
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct TrustedReceipt {
    pub id: String,
    pub sender: String,
    /// The signed outer key is not an identified payer for anonymous/private zaps.
    pub payer: super::Sender,
    pub recipient: String,
    pub provider: String,
    pub payment_hash: String,
    pub target: Target,
    pub amount_msat: u64,
    pub created_at: u64,
    #[serde(with = "proof_serde")]
    pub proof: Arc<IdentityProof>,
    pub provider_observed_at: u64,
    pub verified_at: u64,
}
impl TrustedReceipt {
    /// A provider cannot inflate totals by issuing duplicate receipts or targets.
    pub fn payment_key(&self) -> (String, String, String) {
        (
            self.provider.clone(),
            self.recipient.clone(),
            self.payment_hash.clone(),
        )
    }
    /// Once fully validated, a later profile/provider rotation does not revoke
    /// this historical observation. Retention is bounded by the raw receipt.
    pub fn retained(&self, store: &Store) -> bool {
        store.get(&self.id).is_some()
    }
    /// Original signed comment, parsed only for visible rows; never duplicated in cache.
    pub fn comment(&self, store: &Store) -> Option<String> {
        if matches!(self.payer, super::Sender::Private) {
            return None;
        }
        let raw = store.get(&self.id)?;
        let json = unique(&raw.tags, "description").ok()??;
        let request = lkjstr_nips::event::Event::parse(json, super::MAX_RESPONSE_BYTES).ok()?;
        Some(request.data.content)
    }
}
pub fn receipt(
    store: &Store,
    raw: &NostrEvent,
    provider: Arc<Provider>,
    now: u64,
) -> Result<TrustedReceipt> {
    if now >= provider.expires_at {
        return Err(Failure::Expired);
    }
    let current = binding(store, &provider.binding.recipient)?;
    if current != provider.binding {
        return Err(Failure::Stale);
    }
    let raw = super::event(raw)?;
    if raw.data.pubkey != provider.nostr_pubkey {
        return Err(Failure::Untrusted);
    }
    if raw.data.created_at > now.saturating_add(60) {
        return Err(Failure::Stale);
    }
    let pr = unique(&raw.data.tags, "bolt11")
        .map_err(|_| Failure::Rejected)?
        .ok_or(Failure::Rejected)?
        .to_ascii_lowercase();
    if !pr
        .strip_prefix("lnbc")
        .and_then(|s| s.bytes().next())
        .is_some_and(|b| b.is_ascii_digit())
    {
        return Err(Failure::Unsupported);
    }
    let validated =
        validate_receipt(&raw, &provider.nostr_pubkey, None).map_err(|_| Failure::Rejected)?;
    let details = &validated.details;
    if details.recipient != provider.binding.recipient {
        return Err(Failure::Rejected);
    }
    if let Some(encoded) = &details.lnurl {
        let endpoint = super::url::https(&lnurl::decode(encoded).map_err(|_| Failure::Rejected)?)?;
        if endpoint.as_str() != provider.binding.endpoint {
            return Err(Failure::Untrusted);
        }
    }
    // Address-only requests cannot establish which signed revision authorized a
    // split; event zaps require the event id as specified by NIP-57.
    if details.event.is_none() && details.address.is_some() {
        return Err(Failure::Unsupported);
    }
    let target_value = if let Some(id) = &details.event {
        Target::Event { id: id.clone() }
    } else {
        Target::Profile {
            pubkey: details.recipient.clone(),
        }
    };
    let plan = target(store, &target_value)?;
    if !plan
        .recipients
        .iter()
        .any(|r| r.pubkey == details.recipient && r.weight > 0)
        || details
            .address
            .as_ref()
            .is_some_and(|a| Some(a.to_string()) != plan.address)
        || unique(&validated.request.data.tags, "k")
            .map_err(|_| Failure::Rejected)?
            .is_some_and(|kind| plan.kind.map(|k| k.to_string()).as_deref() != Some(kind))
    {
        return Err(Failure::Rejected);
    }
    let amount_msat = validated.invoice.amount_msat().ok_or(Failure::Rejected)?;
    if amount_msat == 0 {
        return Err(Failure::Rejected);
    }
    if amount_msat > super::MAX_MSAT {
        return Err(Failure::TooLarge);
    }
    // Historical receipts remain meaningful after the invoice expired.
    Ok(TrustedReceipt {
        id: raw.id.clone(),
        payer: super::sender::payer(&validated.request)?,
        sender: validated.request.data.pubkey,
        recipient: details.recipient.clone(),
        provider: provider.nostr_pubkey.clone(),
        payment_hash: lkjstr_nips::hex(validated.invoice.payment_hash()),
        target: target_value,
        amount_msat,
        created_at: raw.data.created_at,
        proof: Arc::new(IdentityProof {
            recipient: provider.binding.recipient.clone(),
            provider: provider.nostr_pubkey.clone(),
            profile: provider.binding.profile.clone(),
            endpoint: provider.binding.endpoint.clone(),
        }),
        provider_observed_at: provider.observed_at,
        verified_at: now,
    })
}

mod proof_serde {
    use super::IdentityProof;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use std::sync::Arc;
    pub fn serialize<S: Serializer>(
        proof: &Arc<IdentityProof>,
        serializer: S,
    ) -> Result<S::Ok, S::Error> {
        proof.as_ref().serialize(serializer)
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(
        deserializer: D,
    ) -> Result<Arc<IdentityProof>, D::Error> {
        IdentityProof::deserialize(deserializer).map(Arc::new)
    }
}

//! Signed zap splits use bounded exact decimal weights and integer remainders.
use super::{Failure, MAX_MSAT, MAX_RECIPIENTS, Result, Target};
use crate::store::Store;
use lkjstr_nips::{address::Coordinate, lnurl, relay::relay_url};
use lkjstr_protocol::NostrEvent;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Recipient {
    pub pubkey: String,
    pub metadata_relays: Vec<String>,
    pub weight: u128,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TargetPlan {
    pub target: Target,
    pub kind: Option<u16>,
    pub address: Option<String>,
    pub recipients: Vec<Recipient>,
}
pub fn target(store: &Store, value: &Target) -> Result<TargetPlan> {
    match value {
        Target::Profile { pubkey } => {
            lnurl::public_key(pubkey).map_err(|_| Failure::Rejected)?;
            Ok(TargetPlan {
                target: value.clone(),
                kind: None,
                address: None,
                recipients: vec![Recipient {
                    pubkey: pubkey.clone(),
                    metadata_relays: vec![],
                    weight: 1,
                }],
            })
        }
        Target::Event { id } => {
            lkjstr_nips::unhex::<32>(id).map_err(|_| Failure::Rejected)?;
            let event = store.get(id).ok_or(Failure::NotFound)?;
            let parsed = super::event(&event)?;
            parsed.verify().map_err(|_| Failure::Rejected)?;
            if matches!(event.kind, 4 | 13 | 14 | 1059) {
                return Err(Failure::Unsupported);
            }
            let address = if (30000..40000).contains(&event.kind) {
                Some(
                    Coordinate::of(&parsed.data)
                        .map_err(|_| Failure::Rejected)?
                        .to_string(),
                )
            } else {
                None
            };
            Ok(TargetPlan {
                target: value.clone(),
                kind: Some(parsed.data.kind),
                address,
                recipients: recipients(&event)?,
            })
        }
    }
}
fn recipients(event: &NostrEvent) -> Result<Vec<Recipient>> {
    let tags: Vec<_> = event
        .tags
        .iter()
        .filter(|t| t.first().is_some_and(|v| v == "zap"))
        .collect();
    if tags.is_empty() {
        return Ok(vec![Recipient {
            pubkey: event.pubkey.clone(),
            metadata_relays: vec![],
            weight: 1,
        }]);
    }
    if tags.len() > MAX_RECIPIENTS {
        return Err(Failure::TooLarge);
    }
    let weighted = tags.iter().any(|t| t.len() > 3);
    let mut recipients: Vec<Recipient> = vec![];
    for tag in tags {
        let pubkey = tag.get(1).ok_or(Failure::Rejected)?;
        lnurl::public_key(pubkey).map_err(|_| Failure::Rejected)?;
        let hint = tag.get(2).ok_or(Failure::Rejected)?;
        let hint = if hint.is_empty() {
            None
        } else {
            Some(relay_url(hint).map_err(|_| Failure::Rejected)?)
        };
        let weight = if weighted {
            tag.get(3)
                .map(|s| decimal_weight(s))
                .transpose()?
                .unwrap_or(0)
        } else {
            1
        };
        if let Some(existing) = recipients.iter_mut().find(|r| r.pubkey == *pubkey) {
            existing.weight += weight;
            if let Some(hint) = hint
                && !existing.metadata_relays.contains(&hint)
            {
                existing.metadata_relays.push(hint);
            }
        } else {
            recipients.push(Recipient {
                pubkey: pubkey.clone(),
                metadata_relays: hint.into_iter().collect(),
                weight,
            });
        }
    }
    recipients.retain(|r| r.weight > 0);
    if recipients.is_empty() {
        return Err(Failure::Rejected);
    }
    Ok(recipients)
}
fn decimal_weight(value: &str) -> Result<u128> {
    if value.len() > 20 {
        return Err(Failure::TooLarge);
    }
    let (whole, fraction) = value.split_once('.').unwrap_or((value, ""));
    if whole.is_empty()
        || !whole.bytes().all(|b| b.is_ascii_digit())
        || !fraction.bytes().all(|b| b.is_ascii_digit())
        || fraction.len() > 9
        || (value.contains('.') && fraction.is_empty())
    {
        return Err(Failure::Unsupported);
    }
    let whole: u128 = whole.parse().map_err(|_| Failure::TooLarge)?;
    if whole > 1_000_000_000 {
        return Err(Failure::TooLarge);
    }
    let mut fraction = fraction.to_owned();
    while fraction.len() < 9 {
        fraction.push('0');
    }
    let fraction: u128 = fraction.parse().map_err(|_| Failure::Rejected)?;
    Ok(whole * 1_000_000_000 + fraction)
}
/// Largest-remainder allocation preserves every millisatoshi. Ties use tag order.
pub fn allocations(plan: &TargetPlan, amount_msat: u64) -> Result<Vec<(String, u64)>> {
    if amount_msat == 0
        || amount_msat > MAX_MSAT
        || plan.recipients.is_empty()
        || plan.recipients.len() > MAX_RECIPIENTS
    {
        return Err(Failure::Rejected);
    }
    let total = plan.recipients.iter().try_fold(0_u128, |total, r| {
        total.checked_add(r.weight).ok_or(Failure::TooLarge)
    })?;
    if total == 0 {
        return Err(Failure::Rejected);
    }
    let mut amounts = vec![];
    let mut remainders = vec![];
    for (i, recipient) in plan.recipients.iter().enumerate() {
        let numerator = u128::from(amount_msat)
            .checked_mul(recipient.weight)
            .ok_or(Failure::TooLarge)?;
        let amount = u64::try_from(numerator / total).map_err(|_| Failure::TooLarge)?;
        amounts.push((recipient.pubkey.clone(), amount));
        remainders.push((i, numerator % total));
    }
    let assigned: u64 = amounts.iter().map(|(_, amount)| amount).sum();
    let remaining = amount_msat - assigned;
    if remaining >= amounts.len() as u64 {
        return Err(Failure::Rejected);
    }
    remainders.sort_by(|(ai, ar), (bi, br)| br.cmp(ar).then(ai.cmp(bi)));
    for (i, _) in remainders.into_iter().take(remaining as usize) {
        amounts[i].1 += 1;
    }
    // Zero invoices cannot be sent: the caller must choose a larger total.
    if amounts.iter().any(|(_, amount)| *amount == 0) {
        return Err(Failure::Rejected);
    }
    Ok(amounts)
}

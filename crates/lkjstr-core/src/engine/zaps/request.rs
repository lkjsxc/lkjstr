//! An explicit action prepares signed HTTP-only requests and unpaid invoices.
use super::{Failure, MAX_MSAT, MAX_RESPONSE_BYTES, Provider, Result, Target, TargetPlan};
use crate::store::Store;
use lkjstr_nips::{
    event::{Event, UnsignedEvent},
    identity::HttpResponse,
    lnurl,
    relay::relay_url,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug)]
pub struct PreparedRequest {
    pub event: UnsignedEvent,
    pub provider: Provider,
    pub target: Target,
    pub amount_msat: u64,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "k", rename_all = "lowercase")]
pub enum SuccessAction {
    Message { message: String },
    Url { description: String, url: String },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IntentState {
    Unpaid,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceIntent {
    pub state: IntentState,
    pub recipient: String,
    pub provider: String,
    pub target: Target,
    pub amount_msat: u64,
    pub invoice: String,
    pub payment_hash: String,
    #[serde(serialize_with = "super::millis")]
    pub expires_at: u64,
    pub success_action: Option<SuccessAction>,
}

/// Pure preparation; the Worker supplies fresh seconds and signs this exact event.
pub fn prepare(
    plan: &TargetPlan,
    provider: &Provider,
    sender: &str,
    amount_msat: u64,
    comment: &str,
    relays: &[String],
    now: u64,
) -> Result<PreparedRequest> {
    lnurl::public_key(sender).map_err(|_| Failure::Rejected)?;
    if now >= provider.expires_at {
        return Err(Failure::Expired);
    }
    if !plan
        .recipients
        .iter()
        .any(|r| r.pubkey == provider.binding.recipient && r.weight > 0)
    {
        return Err(Failure::Rejected);
    }
    if amount_msat < provider.min_msat
        || amount_msat > provider.max_msat
        || amount_msat == 0
        || amount_msat > MAX_MSAT
    {
        return Err(Failure::Rejected);
    }
    if comment.len() > 4096 || relays.is_empty() || relays.len() > 16 {
        return Err(Failure::TooLarge);
    }
    let mut relay_tag = vec!["relays".to_owned()];
    for relay in relays {
        let relay = relay_url(relay).map_err(|_| Failure::Rejected)?;
        if !relay_tag[1..].contains(&relay) {
            relay_tag.push(relay);
        }
    }
    let mut tags = vec![
        vec!["p".into(), provider.binding.recipient.clone()],
        vec!["P".into(), provider.nostr_pubkey.clone()],
        vec!["amount".into(), amount_msat.to_string()],
        vec!["lnurl".into(), provider.binding.lnurl.clone()],
        relay_tag,
    ];
    if let Target::Event { id } = &plan.target {
        tags.push(vec!["e".into(), id.clone()]);
    }
    if let Some(kind) = plan.kind {
        tags.push(vec!["k".into(), kind.to_string()]);
    }
    if let Some(address) = &plan.address {
        tags.push(vec!["a".into(), address.clone()]);
    }
    Ok(PreparedRequest {
        event: UnsignedEvent::new(sender.to_owned(), now, 9734, tags, comment),
        provider: provider.clone(),
        target: plan.target.clone(),
        amount_msat,
    })
}
impl PreparedRequest {
    /// A profile replacement during signer/HTTP work revokes this pending intent.
    pub fn current(&self, store: &Store, now: u64) -> Result<()> {
        if now >= self.provider.expires_at
            || !store
                .replaceable(&self.provider.binding.recipient, 0)
                .is_some_and(|profile| profile.id == self.provider.binding.profile)
        {
            return Err(Failure::Stale);
        }
        Ok(())
    }
    /// The verified event's exact JSON is the invoice description commitment.
    /// This URL is fetched once; it is never sent to a relay as an EVENT.
    pub fn callback(&self, store: &Store, signed: &Event, now: u64) -> Result<(String, String)> {
        self.current(store, now)?;
        signed.verify().map_err(|_| Failure::Rejected)?;
        if signed.data != self.event {
            return Err(Failure::Stale);
        }
        let json = signed.to_json().map_err(|_| Failure::Rejected)?;
        let mut url = super::url::https(&self.provider.callback)?;
        let mut pairs = url.query_pairs_mut();
        pairs
            .append_pair("amount", &self.amount_msat.to_string())
            .append_pair("nostr", &json)
            .append_pair("lnurl", &self.provider.binding.lnurl);
        // NIP-57 content does not require LUD-12 comment support. Send the optional
        // LNURL comment only when the provider explicitly accepts its character count.
        if !self.event.content.is_empty()
            && self.event.content.chars().count() <= self.provider.comment_allowed
        {
            pairs.append_pair("comment", &self.event.content);
        }
        drop(pairs);
        if url.as_str().len() > 32 * 1024 {
            return Err(Failure::TooLarge);
        }
        Ok((url.to_string(), json))
    }
}
pub fn invoice(
    store: &Store,
    prepared: &PreparedRequest,
    request_json: &str,
    callback: &str,
    response: &HttpResponse,
    now: u64,
) -> Result<InvoiceIntent> {
    prepared.current(store, now)?;
    if response.status != 200 || response.final_url != callback {
        return Err(Failure::Network);
    }
    if response.body.len() > MAX_RESPONSE_BYTES {
        return Err(Failure::TooLarge);
    }
    let request = Event::parse(request_json, MAX_RESPONSE_BYTES).map_err(|_| Failure::Rejected)?;
    let (expected_callback, committed_json) = prepared.callback(store, &request, now)?;
    if expected_callback != callback || request_json != committed_json {
        return Err(Failure::Rejected);
    }
    let value: Value = serde_json::from_str(&response.body).map_err(|_| Failure::Rejected)?;
    if value.get("status").and_then(Value::as_str) == Some("ERROR") {
        return Err(Failure::Network);
    }
    let pr = value
        .get("pr")
        .and_then(Value::as_str)
        .ok_or(Failure::Rejected)?;
    let lower = pr.to_ascii_lowercase();
    // Only mainnet invoices are useful to the current product. Reject test chains.
    if !lower
        .strip_prefix("lnbc")
        .and_then(|s| s.bytes().next())
        .is_some_and(|b| b.is_ascii_digit())
    {
        return Err(Failure::Unsupported);
    }
    let parsed = lnurl::invoice(pr, committed_json.as_bytes(), prepared.amount_msat)
        .map_err(|_| Failure::Rejected)?;
    let expires_at = parsed
        .timestamp()
        .checked_add(parsed.expiry())
        .ok_or(Failure::Rejected)?;
    if expires_at > MAX_MSAT / 1000 {
        return Err(Failure::TooLarge);
    }
    if parsed.timestamp() > now.saturating_add(60) || expires_at <= now {
        return Err(Failure::Expired);
    }
    let success_action = value
        .get("successAction")
        .filter(|a| !a.is_null())
        .map(|a| success(a, &prepared.provider.callback))
        .transpose()?;
    Ok(InvoiceIntent {
        state: IntentState::Unpaid,
        recipient: prepared.provider.binding.recipient.clone(),
        provider: prepared.provider.nostr_pubkey.clone(),
        target: prepared.target.clone(),
        amount_msat: prepared.amount_msat,
        invoice: pr.to_owned(),
        payment_hash: lkjstr_nips::hex(parsed.payment_hash()),
        expires_at,
        success_action,
    })
}
fn success(value: &Value, callback: &str) -> Result<SuccessAction> {
    let limited = |key| -> Result<String> {
        let text = value
            .get(key)
            .and_then(Value::as_str)
            .ok_or(Failure::Rejected)?;
        if text.chars().count() > 144 {
            return Err(Failure::TooLarge);
        }
        Ok(text.to_owned())
    };
    match value.get("tag").and_then(Value::as_str) {
        Some("message") => Ok(SuccessAction::Message {
            message: limited("message")?,
        }),
        Some("url") => {
            let description = limited("description")?;
            let url = super::url::https(
                value
                    .get("url")
                    .and_then(Value::as_str)
                    .ok_or(Failure::Rejected)?,
            )?;
            let callback = super::url::https(callback)?;
            if url.host_str() != callback.host_str() {
                return Err(Failure::Rejected);
            }
            Ok(SuccessAction::Url {
                description,
                url: url.to_string(),
            })
        }
        _ => Err(Failure::Unsupported),
    }
}

//! LNURL-pay discovery is authorized by one profile generation and expires.
use super::{Binding, Failure, MAX_MSAT, MAX_RESPONSE_BYTES, PROVIDER_TTL, Result, url::https};
use lkjstr_nips::{identity::HttpResponse, lnurl};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Provider {
    pub binding: Binding,
    pub nostr_pubkey: String,
    pub callback: String,
    pub min_msat: u64,
    pub max_msat: u64,
    pub comment_allowed: usize,
    pub description: String,
    pub observed_at: u64,
    pub expires_at: u64,
}
pub fn provider(binding: Binding, response: &HttpResponse, now: u64) -> Result<Provider> {
    if response.status != 200 || response.final_url != binding.endpoint {
        return Err(Failure::Network);
    }
    if response.body.len() > MAX_RESPONSE_BYTES {
        return Err(Failure::TooLarge);
    }
    let v: Value = serde_json::from_str(&response.body).map_err(|_| Failure::Rejected)?;
    if v.get("status").and_then(Value::as_str) == Some("ERROR") {
        return Err(Failure::Network);
    }
    if v.get("tag").and_then(Value::as_str) != Some("payRequest") {
        return Err(Failure::Unsupported);
    }
    if v.get("allowsNostr").and_then(Value::as_bool) != Some(true) {
        return Err(Failure::Unsupported);
    }
    let key = text(&v, "nostrPubkey")?;
    lnurl::public_key(key).map_err(|_| Failure::Rejected)?;
    let callback = https(text(&v, "callback")?)?;
    if callback
        .query_pairs()
        .any(|(key, _)| matches!(key.as_ref(), "nostr" | "amount" | "lnurl" | "comment"))
    {
        return Err(Failure::Rejected);
    }
    let min = number(&v, "minSendable")?;
    let max = number(&v, "maxSendable")?;
    if min == 0 || max < min {
        return Err(Failure::Rejected);
    }
    if min > MAX_MSAT {
        return Err(Failure::Unsupported);
    }
    let comment = v
        .get("commentAllowed")
        .map(|c| c.as_u64().ok_or(Failure::Rejected))
        .transpose()?
        .unwrap_or(0);
    if let Some(payer) = v.get("payerData") {
        let fields = payer.as_object().ok_or(Failure::Rejected)?;
        for requirements in fields.values() {
            let mandatory = requirements
                .get("mandatory")
                .and_then(Value::as_bool)
                .ok_or(Failure::Rejected)?;
            if mandatory {
                return Err(Failure::Unsupported);
            }
        }
    }
    let description = metadata(text(&v, "metadata")?, &binding)?;
    Ok(Provider {
        binding,
        nostr_pubkey: key.to_owned(),
        callback: callback.to_string(),
        min_msat: min,
        max_msat: max.min(MAX_MSAT),
        comment_allowed: comment.min(4096) as usize,
        description,
        observed_at: now,
        expires_at: now.saturating_add(PROVIDER_TTL),
    })
}
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v.get(key).and_then(Value::as_str).ok_or(Failure::Rejected)
}
fn number(v: &Value, key: &str) -> Result<u64> {
    v.get(key).and_then(Value::as_u64).ok_or(Failure::Rejected)
}
fn metadata(raw: &str, binding: &Binding) -> Result<String> {
    let parsed: Value = serde_json::from_str(raw).map_err(|_| Failure::Rejected)?;
    let entries = parsed.as_array().ok_or(Failure::Rejected)?;
    if entries.len() > 32 {
        return Err(Failure::TooLarge);
    }
    let mut plain = None;
    let mut image = false;
    let mut address = binding.address.is_none();
    for entry in entries {
        let pair = entry
            .as_array()
            .filter(|p| p.len() == 2)
            .ok_or(Failure::Rejected)?;
        let kind = pair[0].as_str().ok_or(Failure::Rejected)?;
        match kind {
            "text/plain" => {
                let value = pair[1].as_str().ok_or(Failure::Rejected)?;
                if plain.replace(value.to_owned()).is_some() || value.len() > 4096 {
                    return Err(Failure::Rejected);
                }
            }
            "image/png;base64" | "image/jpeg;base64" => {
                if image || !pair[1].is_string() {
                    return Err(Failure::Rejected);
                }
                image = true;
            }
            "text/identifier" | "text/email" => {
                address |= binding
                    .address
                    .as_deref()
                    .zip(pair[1].as_str())
                    .is_some_and(|(expected, actual)| {
                        super::endpoint::address_matches(expected, actual)
                    });
            }
            _ => {}
        }
    }
    if !address {
        return Err(Failure::Rejected);
    }
    plain.ok_or(Failure::Rejected)
}

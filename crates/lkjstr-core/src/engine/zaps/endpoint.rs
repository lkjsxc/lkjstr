//! A recipient's verified current profile binds automatic discovery to its endpoint.
use super::{Failure, Result, url::https};
use crate::store::Store;
use lkjstr_nips::lnurl;
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Binding {
    pub recipient: String,
    pub profile: String,
    pub endpoint: String,
    pub lnurl: String,
    pub address: Option<String>,
}
pub fn binding(store: &Store, recipient: &str) -> Result<Binding> {
    lnurl::public_key(recipient).map_err(|_| Failure::Rejected)?;
    let profile = store.replaceable(recipient, 0).ok_or(Failure::NotFound)?;
    let parsed = super::event(&profile)?;
    parsed.verify().map_err(|_| Failure::Rejected)?;
    let value: Value = serde_json::from_str(&profile.content).map_err(|_| Failure::Rejected)?;
    let object = value.as_object().ok_or(Failure::Rejected)?;
    let text = |field| -> Result<Option<&str>> {
        match object.get(field) {
            None | Some(Value::Null) => Ok(None),
            Some(Value::String(s)) if s.is_empty() => Ok(None),
            Some(Value::String(s)) => Ok(Some(s)),
            _ => Err(Failure::Rejected),
        }
    };
    let (endpoint, address) = if let Some(address) = text("lud16")? {
        {
            let endpoint = lightning_address(address)?;
            let name = address.rsplit_once('@').ok_or(Failure::Rejected)?.0;
            let name = if name.is_empty() { "_" } else { name };
            let canonical = format!("{name}@{}", endpoint.host_str().ok_or(Failure::Rejected)?);
            (endpoint, Some(canonical))
        }
    } else if let Some(encoded) = text("lud06")? {
        (
            https(&lnurl::decode(encoded).map_err(|_| Failure::Rejected)?)?,
            None,
        )
    } else {
        return Err(Failure::Unsupported);
    };
    let endpoint = endpoint.to_string();
    let encoded = lnurl::encode(&endpoint).map_err(|_| Failure::Rejected)?;
    Ok(Binding {
        recipient: recipient.to_owned(),
        profile: profile.id.clone(),
        endpoint,
        lnurl: encoded,
        address,
    })
}
fn lightning_address(address: &str) -> Result<url::Url> {
    if address.len() > 320 {
        return Err(Failure::TooLarge);
    }
    let (name, domain) = address.rsplit_once('@').ok_or(Failure::Rejected)?;
    let name = if name.is_empty() { "_" } else { name };
    if name.len() > 128
        || !name.bytes().all(|b| {
            b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'-' | b'_' | b'.' | b'+')
        })
        || domain.is_empty()
        || domain
            .chars()
            .any(|c| c.is_whitespace() || "/?#:@\\%".contains(c))
    {
        return Err(Failure::Rejected);
    }
    let mut endpoint = https(&format!("https://{domain}/"))?;
    endpoint.set_path(&format!("/.well-known/lnurlp/{name}"));
    Ok(endpoint)
}

/// LUD-16 tags may be stripped by the service; domains compare canonically.
pub(super) fn address_matches(expected: &str, actual: &str) -> bool {
    let Ok(endpoint) = lightning_address(actual) else {
        return false;
    };
    let Some((name, _)) = actual.rsplit_once('@') else {
        return false;
    };
    let name = if name.is_empty() { "_" } else { name };
    let Some(domain) = endpoint.host_str() else {
        return false;
    };
    let canonical = format!("{name}@{domain}");
    if canonical == expected {
        return true;
    }
    let Some((expected_name, expected_domain)) = expected.rsplit_once('@') else {
        return false;
    };
    expected_name
        .split_once('+')
        .is_some_and(|(base, _)| canonical == format!("{base}@{expected_domain}"))
}

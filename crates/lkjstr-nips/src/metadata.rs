//! NIP-11 relay information, NIP-40 expiration, and NIP-36 content warnings.
use crate::{
    Error, Result,
    event::{UnsignedEvent, unique},
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Extensible NIP-11 information document; all known fields are optional.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RelayInformation {
    /// Human-readable relay name.
    pub name: Option<String>,
    /// Plain-text description.
    pub description: Option<String>,
    /// Banner URL (untrusted, not fetched).
    pub banner: Option<String>,
    /// Icon URL (untrusted, not fetched).
    pub icon: Option<String>,
    /// Administrative contact key.
    pub pubkey: Option<String>,
    /// Relay identity key.
    #[serde(rename = "self")]
    pub identity: Option<String>,
    /// Alternate contact URI.
    pub contact: Option<String>,
    /// Advertised NIP numbers; advertisement is not conformance proof.
    #[serde(default)]
    pub supported_nips: Vec<u32>,
    /// Relay software project URL.
    pub software: Option<String>,
    /// Software version string.
    pub version: Option<String>,
    /// Terms-of-service URL.
    pub terms_of_service: Option<String>,
    /// Structured relay limitations, retained for future NIP extensions.
    pub limitation: Option<BTreeMap<String, serde_json::Value>>,
    /// Unknown fields, retained without interpretation.
    #[serde(flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}
impl RelayInformation {
    /// Parse a bounded information document. No URLs or markup are executed.
    pub fn parse(json: &str, max_bytes: usize) -> Result<Self> {
        if json.len() > max_bytes {
            return Err(Error::Size);
        }
        Ok(serde_json::from_str(json)?)
    }
    /// Check capability advertisement, e.g. NIP-50 search.
    pub fn supports(&self, nip: u32) -> bool {
        self.supported_nips.contains(&nip)
    }
}
/// NIP-11 request parameters. The host owns HTTP and response limits.
pub fn information_request(relay: &str) -> Result<(String, &'static str)> {
    let mut url = url::Url::parse(&crate::relay::relay_url(relay)?).map_err(|_| Error::Invalid)?;
    let scheme = if url.scheme() == "wss" {
        "https"
    } else {
        "http"
    };
    url.set_scheme(scheme).map_err(|_| Error::Invalid)?;
    Ok((url.into(), "application/nostr+json"))
}
/// Strict decimal parser for timestamp/amount tags; no signs or whitespace.
pub(crate) fn decimal(value: &str) -> Result<u64> {
    if value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
        return Err(Error::Invalid);
    }
    value.parse().map_err(|_| Error::Invalid)
}
/// NIP-40 expiration timestamp. Ambiguous or malformed tags are errors.
pub fn expiration(event: &UnsignedEvent) -> Result<Option<u64>> {
    unique(&event.tags, "expiration")?.map(decimal).transpose()
}
/// Expired at or after the expiration timestamp. Clock is supplied by the host.
pub fn is_expired(event: &UnsignedEvent, now: u64) -> Result<bool> {
    Ok(expiration(event)?.is_some_and(|timestamp| now >= timestamp))
}
/// NIP-36 warning; `Some("")` means a warning without a reason.
pub fn content_warning(event: &UnsignedEvent) -> Option<&str> {
    event
        .tags
        .iter()
        .find(|t| t.first().is_some_and(|n| n == "content-warning"))
        .map(|t| t.get(1).map_or("", String::as_str))
}

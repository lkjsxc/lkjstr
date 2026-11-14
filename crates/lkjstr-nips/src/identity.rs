//! NIP-05 identifier binding. HTTP is injected; redirects are forbidden.
use crate::{Error, Result, relay::relay_url, unhex};
use serde::Deserialize;
use std::{collections::BTreeMap, future::Future};

/// Parsed local-part and DNS domain. Bare domains resolve to `_`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identifier {
    /// Case-sensitive lowercase NIP-05 local-part.
    pub name: String,
    /// Canonical ASCII DNS name.
    pub domain: String,
}
impl Identifier {
    /// Parse `alice@example.com` or the root alias `example.com`.
    pub fn parse(input: &str) -> Result<Self> {
        let (name, domain) = input.split_once('@').unwrap_or(("_", input));
        if name.is_empty()
            || !name
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"-_.".contains(&b))
        {
            return Err(Error::Invalid);
        }
        // Accept DNS names, including IDNA; reject URL/userinfo/port injection.
        if domain.is_empty()
            || domain
                .chars()
                .any(|c| c.is_whitespace() || "/:@?#\\%".contains(c))
        {
            return Err(Error::Invalid);
        }
        let url = url::Url::parse(&format!("https://{domain}/")).map_err(|_| Error::Invalid)?;
        let ascii = url.host_str().ok_or(Error::Invalid)?.to_owned();
        if ascii.len() > 253
            || ascii.split('.').any(|label| {
                label.is_empty()
                    || label.len() > 63
                    || label.starts_with('-')
                    || label.ends_with('-')
                    || !label
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b == b'-')
            })
        {
            return Err(Error::Invalid);
        }
        Ok(Self {
            name: name.into(),
            domain: ascii,
        })
    }
    /// Canonical unredirected HTTPS endpoint.
    pub fn url(&self) -> String {
        format!(
            "https://{}/.well-known/nostr.json?name={}",
            self.domain, self.name
        )
    }
}
/// HTTP adapter request. Adapters MUST enforce these redirect/size constraints.
#[derive(Clone, Debug)]
pub struct HttpRequest {
    /// HTTPS endpoint.
    pub url: String,
    /// Always false for NIP-05.
    pub follow_redirects: bool,
    /// Maximum response body bytes accepted by this call.
    pub max_bytes: usize,
}
/// HTTP response evidence supplied by an adapter.
#[derive(Clone, Debug)]
pub struct HttpResponse {
    /// HTTP status.
    pub status: u16,
    /// Actual response URL, checked to detect redirects.
    pub final_url: String,
    /// JSON body (must be bounded by the adapter as it is read).
    pub body: String,
}
#[derive(Deserialize)]
struct Document {
    names: BTreeMap<String, String>,
    #[serde(default)]
    relays: BTreeMap<String, Vec<String>>,
}
/// A verified name-to-key binding, not proof of a person's real-world identity.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Binding {
    /// Validated identifier.
    pub identifier: Identifier,
    /// Exact expected key, never silently replaced from a lookup result.
    pub pubkey: String,
    /// Valid discovery relay hints from the document.
    pub relays: Vec<String>,
}
/// Validate HTTP evidence and the exact, lowercase key binding.
pub fn verify_response(
    identifier: &Identifier,
    expected_key: &str,
    response: HttpResponse,
    max_bytes: usize,
) -> Result<Binding> {
    unhex::<32>(expected_key)?;
    // Reparse public fields so callers cannot bypass identifier validation.
    let valid = Identifier::parse(&format!("{}@{}", identifier.name, identifier.domain))?;
    if &valid != identifier {
        return Err(Error::Invalid);
    }
    if response.status != 200 || response.final_url != identifier.url() {
        return Err(Error::Http);
    }
    if response.body.len() > max_bytes {
        return Err(Error::Size);
    }
    let doc: Document = serde_json::from_str(&response.body)?;
    if doc.names.get(&identifier.name).map(String::as_str) != Some(expected_key) {
        return Err(Error::Identity);
    }
    let relays = doc
        .relays
        .get(expected_key)
        .into_iter()
        .flatten()
        .filter_map(|r| relay_url(r).ok())
        .collect();
    Ok(Binding {
        identifier: identifier.clone(),
        pubkey: expected_key.into(),
        relays,
    })
}
/// Verify through an injected async HTTP fetcher. The adapter must not follow
/// redirects; failures and CORS denial propagate without a fabricated binding.
///
/// ```no_run
/// # async fn demo() -> lkjstr_nips::Result<()> {
/// use lkjstr_nips::identity::{verify, HttpResponse};
/// let result = verify("alice@example.com", &"ab".repeat(32), 65536, |request| async move {
///     // Connect this closure to the browser HTTP adapter.
///     Err::<HttpResponse, _>(lkjstr_nips::Error::Http)
/// }).await;
/// assert!(result.is_err());
/// # Ok(()) }
/// ```
pub async fn verify<F, Fut>(
    input: &str,
    expected_key: &str,
    max_bytes: usize,
    fetch: F,
) -> Result<Binding>
where
    F: FnOnce(HttpRequest) -> Fut,
    Fut: Future<Output = Result<HttpResponse>>,
{
    let identifier = Identifier::parse(input)?;
    unhex::<32>(expected_key)?;
    let response = fetch(HttpRequest {
        url: identifier.url(),
        follow_redirects: false,
        max_bytes,
    })
    .await?;
    verify_response(&identifier, expected_key, response, max_bytes)
}

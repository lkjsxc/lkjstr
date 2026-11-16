//! Auth URLs are intermediate, authenticated NIP-46 replies, never terminal errors.
use super::Remote;
use crate::{self as p, NostrEvent};
use lkjstr_nips::nip44;
use serde_json::Value;

pub struct AuthUrl(String);
impl AuthUrl {
    pub fn parse(text: &str) -> Option<Self> {
        if text.is_empty()
            || text.len() > 4096
            || text.chars().any(|c| c.is_control() || c.is_whitespace())
            || text.contains('\\')
        {
            return None;
        }
        let url = url::Url::parse(text).ok()?;
        if !url.username().is_empty() || url.password().is_some() || url.host().is_none() {
            return None;
        }
        let authority = text.split_once("://")?.1.split(['/', '?', '#']).next()?;
        if authority.contains('@') {
            return None;
        }
        let local = authority == "127.0.0.1"
            || authority.starts_with("127.0.0.1:")
            || authority == "[::1]"
            || authority.starts_with("[::1]:");
        if url.scheme() != "https" && !(url.scheme() == "http" && local) {
            return None;
        }
        Some(Self(text.into()))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}
impl core::fmt::Debug for AuthUrl {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("AuthUrl([REDACTED])")
    }
}
pub enum Response {
    Complete(Result<String, &'static str>),
    Authenticate(AuthUrl),
}
impl core::fmt::Debug for Response {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(match self {
            Self::Authenticate(_) => "Authenticate([REDACTED])",
            Self::Complete(_) => "Complete([REDACTED])",
        })
    }
}
impl Remote {
    /// Verify signer, recipient, signature and request correlation before classifying.
    pub fn classify_response(
        &self,
        event: &NostrEvent,
        id: &str,
        private: bool,
    ) -> Option<Response> {
        if event.kind != 24133
            || event.pubkey != self.peer
            || !matches!(p::verify_event(event), p::VerificationResult::Ok(_))
            || !p::tags::tag_values(event, "p").contains(&self.client()?)
        {
            return None;
        }
        let secret = self.secret()?;
        let peer = p::hex_to_bytes(&self.peer).ok()?.try_into().ok()?;
        let key = nip44::conversation_key(&secret, &peer).ok()?;
        let text = nip44::decrypt(&event.content, &key).ok()?;
        let value: Value = serde_json::from_str(&text).ok()?;
        if value["id"] != id {
            return None;
        }
        if value["result"].as_str() == Some("auth_url") {
            return Some(match value["error"].as_str().and_then(AuthUrl::parse) {
                Some(url) => Response::Authenticate(url),
                None => Response::Complete(Err("signer-refused")),
            });
        }
        if !value["error"].is_null() {
            return Some(Response::Complete(Err(
                if private && value["error"].as_str() == Some("unsupported") {
                    "unsupported"
                } else {
                    "signer-refused"
                },
            )));
        }
        Some(Response::Complete(
            value["result"]
                .as_str()
                .map(str::to_owned)
                .ok_or("signer-refused"),
        ))
    }
}

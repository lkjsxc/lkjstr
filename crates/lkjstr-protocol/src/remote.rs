//! NIP-46 bunker sessions. Device credentials are private persistence only.
use crate::{self as p, NostrEvent, UnsignedNostrEvent};
use lkjstr_nips::{keys::SecretKey, nip44};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
#[derive(Clone, Serialize, Deserialize)]
pub struct Remote {
    pub peer: String,
    pub relays: Vec<String>,
    client_secret: String,
}
impl Remote {
    pub fn parse(url: &str) -> Option<(Self, Option<String>)> {
        let url = url::Url::parse(url).ok()?;
        if url.scheme() != "bunker" || !p::is_pubkey(url.host_str()?) {
            return None;
        }
        let mut relays = vec![];
        let mut token = None;
        for (key, value) in url.query_pairs() {
            if key == "relay" {
                let u = url::Url::parse(&value).ok()?;
                if !matches!(u.scheme(), "ws" | "wss") {
                    return None;
                }
                relays.push(p::normalize_relay_url(&value)?);
            }
            if key == "secret" {
                token = Some(value.into_owned());
            }
        }
        if relays.is_empty() || relays.len() > 3 {
            return None;
        }
        let secret = p::generate_secret_key();
        Some((
            Self {
                peer: url.host_str()?.into(),
                relays,
                client_secret: p::bytes_to_hex(secret.as_bytes()),
            },
            token,
        ))
    }
    fn secret(&self) -> Option<SecretKey> {
        SecretKey::from_bytes(*p::parse_secret_key_hex(&self.client_secret)?.as_bytes()).ok()
    }
    pub fn client(&self) -> Option<String> {
        Some(self.secret()?.public_key())
    }
    pub fn request(
        &self,
        id: &str,
        method: &str,
        params: Vec<String>,
        at: u64,
    ) -> Option<NostrEvent> {
        let secret = self.secret()?;
        let peer = p::hex_to_bytes(&self.peer).ok()?.try_into().ok()?;
        let key = nip44::conversation_key(&secret, &peer).ok()?;
        let nonce = p::generate_secret_key();
        let content = nip44::encrypt(
            &json!({"id":id,"method":method,"params":params}).to_string(),
            &key,
            nonce.as_bytes(),
        )
        .ok()?;
        p::sign_event_with_secret_hex(
            &UnsignedNostrEvent {
                pubkey: secret.public_key(),
                kind: 24133,
                created_at: at,
                tags: vec![vec!["p".into(), self.peer.clone()]],
                content,
            },
            &self.client_secret,
        )
        .ok()
    }
    pub fn response(&self, event: &NostrEvent, id: &str) -> Option<Result<String, &'static str>> {
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
        if !value["error"].is_null() {
            return Some(Err("signer-refused"));
        }
        Some(
            value["result"]
                .as_str()
                .map(str::to_owned)
                .ok_or("signer-refused"),
        )
    }
}

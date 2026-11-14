//! NIP-01 canonical events. Parsers impose a byte bound before JSON allocation.
use crate::{Error, Result, hex, keys, unhex};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// A Nostr tag: arbitrary strings, with the first string naming the tag.
pub type Tag = Vec<String>;
/// Unsigned canonical payload.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnsignedEvent {
    /// Lowercase x-only public key.
    pub pubkey: String,
    /// Unix seconds supplied by the caller.
    pub created_at: u64,
    /// NIP-01 kind in `[0, 65535]`.
    pub kind: u16,
    /// Ordered tags; order affects the event ID.
    pub tags: Vec<Tag>,
    /// UTF-8 content.
    pub content: String,
}
/// A rumor has an ID but no signature (NIP-59).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rumor {
    /// Canonical event ID.
    pub id: String,
    /// Unsigned fields, flattened on the wire.
    #[serde(flatten)]
    pub data: UnsignedEvent,
}
/// Signed NIP-01 event; wire fields are flat.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Event {
    /// Canonical event ID.
    pub id: String,
    /// Unsigned fields, flattened on the wire.
    #[serde(flatten)]
    pub data: UnsignedEvent,
    /// Lowercase 64-byte Schnorr signature.
    pub sig: String,
}
impl UnsignedEvent {
    /// Construct a payload; signing/hash operations validate its structure.
    pub fn new(
        pubkey: String,
        created_at: u64,
        kind: u16,
        tags: Vec<Tag>,
        content: impl Into<String>,
    ) -> Self {
        Self {
            pubkey,
            created_at,
            kind,
            tags,
            content: content.into(),
        }
    }
    /// Validate canonical fields. Empty tags are forbidden by NIP-01.
    pub fn validate(&self) -> Result<()> {
        unhex::<32>(&self.pubkey)?;
        if self.tags.iter().any(Vec::is_empty) {
            return Err(Error::Invalid);
        }
        Ok(())
    }
    /// Serialize exactly `[0,pubkey,created_at,kind,tags,content]` as UTF-8 JSON.
    pub fn canonical(&self) -> Result<String> {
        self.validate()?;
        Ok(serde_json::to_string(&(
            0,
            &self.pubkey,
            self.created_at,
            self.kind,
            &self.tags,
            &self.content,
        ))?)
    }
    /// SHA-256 of canonical serialization.
    pub fn id_bytes(&self) -> Result<[u8; 32]> {
        Ok(Sha256::digest(self.canonical()?.as_bytes()).into())
    }
    /// Construct an unsigned, hash-bound rumor.
    pub fn rumor(self) -> Result<Rumor> {
        Ok(Rumor {
            id: hex(&self.id_bytes()?),
            data: self,
        })
    }
    /// Sign with explicit auxiliary randomness and matching author key.
    pub fn sign(self, secret: &keys::SecretKey, auxiliary: &[u8; 32]) -> Result<Event> {
        if self.pubkey != secret.public_key() {
            return Err(Error::Identity);
        }
        let id = self.id_bytes()?;
        let sig = hex(&secret.sign(&id, auxiliary)?);
        Ok(Event {
            id: hex(&id),
            data: self,
            sig,
        })
    }
}
impl Rumor {
    /// Recompute and check the rumor ID. This is not a signature check.
    pub fn verify_id(&self) -> Result<()> {
        if unhex::<32>(&self.id)? != self.data.id_bytes()? {
            return Err(Error::EventId);
        }
        Ok(())
    }
}
impl Event {
    /// Bound JSON input before deserialization, then authenticate it.
    pub fn parse(json: &str, max_bytes: usize) -> Result<Self> {
        if json.len() > max_bytes {
            return Err(Error::Size);
        }
        let event: Self = serde_json::from_str(json)?;
        event.verify()?;
        Ok(event)
    }
    /// Recompute the ID before checking its BIP-340 signature.
    pub fn verify(&self) -> Result<()> {
        let id = unhex::<32>(&self.id)?;
        if id != self.data.id_bytes()? {
            return Err(Error::EventId);
        }
        keys::verify(&unhex(&self.data.pubkey)?, &id, &unhex(&self.sig)?)
    }
    /// Serialize a signed event for relay transport.
    pub fn to_json(&self) -> Result<String> {
        Ok(serde_json::to_string(self)?)
    }
}
/// Values of tags with at least two fields; malformed short tags are skipped.
pub fn values<'a>(tags: &'a [Tag], name: &'a str) -> impl Iterator<Item = &'a str> {
    tags.iter()
        .filter(move |t| t.first().is_some_and(|n| n == name))
        .filter_map(|t| t.get(1).map(String::as_str))
}
/// A unique tag's value. Duplicate or malformed matching tags are rejected.
pub fn unique<'a>(tags: &'a [Tag], name: &str) -> Result<Option<&'a str>> {
    let mut matches = tags.iter().filter(|t| t.first().is_some_and(|n| n == name));
    let value = matches
        .next()
        .map(|t| t.get(1).map(String::as_str).ok_or(Error::Invalid))
        .transpose()?;
    if matches.next().is_some() {
        return Err(Error::Invalid);
    }
    Ok(value)
}

//! NIP-19 Bech32 (not Bech32m) and NIP-21 public URIs.
//!
//! ```
//! use lkjstr_nips::entity::Entity;
//! # fn main() -> lkjstr_nips::Result<()> {
//! let note = Entity::Note([7; 32]);
//! let uri = note.to_uri()?;
//! assert_eq!(Entity::from_uri(&uri)?.encode()?, note.encode()?);
//! # Ok(()) }
//! ```
use crate::{Error, Result, bech32_checksum::ProtocolBech32, keys::SecretKey, tlv};
use bech32::{Hrp, primitives::decode::CheckedHrpstring};

/// NIP-19 entities. Nsec Debug output is always redacted.
#[derive(Clone)]
pub enum Entity {
    /// X-only public key.
    Npub([u8; 32]),
    /// User-authorized secret import/export only; excluded from NIP-21.
    Nsec(SecretKey),
    /// Event ID.
    Note([u8; 32]),
    /// Profile with discovery relay hints.
    Profile {
        /// Public key.
        pubkey: [u8; 32],
        /// Relay hints in TLV order.
        relays: Vec<String>,
    },
    /// Event with optional discovery metadata.
    Event {
        /// Event ID.
        id: [u8; 32],
        /// Relay hints.
        relays: Vec<String>,
        /// Optional author key.
        author: Option<[u8; 32]>,
        /// Optional kind, encoded as u32 by NIP-19.
        kind: Option<u32>,
    },
    /// Addressable or replaceable event coordinate.
    Address {
        /// D-tag value, possibly empty.
        identifier: String,
        /// Event author.
        author: [u8; 32],
        /// Event kind.
        kind: u32,
        /// Relay hints.
        relays: Vec<String>,
    },
}
impl core::fmt::Debug for Entity {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::Nsec(_) => f.write_str("Nsec([REDACTED])"),
            _ => f.debug_tuple("Entity").field(&self.encode().ok()).finish(),
        }
    }
}
impl Entity {
    /// Encode with the original Bech32 checksum. Maximum 5000 characters.
    pub fn encode(&self) -> Result<String> {
        let mut bytes = Vec::new();
        let (hrp, relays): (&str, &[String]) = match self {
            Self::Npub(v) => {
                bytes.extend(v);
                ("npub", &[])
            }
            Self::Nsec(v) => {
                bytes.extend(v.as_bytes());
                ("nsec", &[])
            }
            Self::Note(v) => {
                bytes.extend(v);
                ("note", &[])
            }
            Self::Profile { pubkey, relays } => {
                tlv::push(&mut bytes, 0, pubkey)?;
                ("nprofile", relays)
            }
            Self::Event { id, relays, .. } => {
                tlv::push(&mut bytes, 0, id)?;
                ("nevent", relays)
            }
            Self::Address {
                identifier, relays, ..
            } => {
                tlv::push(&mut bytes, 0, identifier.as_bytes())?;
                ("naddr", relays)
            }
        };
        for relay in relays {
            if !relay.is_ascii() {
                return Err(Error::Invalid);
            }
            tlv::push(&mut bytes, 1, relay.as_bytes())?;
        }
        match self {
            Self::Event { author, kind, .. } => {
                if let Some(v) = author {
                    tlv::push(&mut bytes, 2, v)?;
                }
                if let Some(v) = kind {
                    tlv::push(&mut bytes, 3, &v.to_be_bytes())?;
                }
            }
            Self::Address { author, kind, .. } => {
                tlv::push(&mut bytes, 2, author)?;
                tlv::push(&mut bytes, 3, &kind.to_be_bytes())?;
            }
            _ => {}
        }
        let hrp = Hrp::parse(hrp).map_err(|_| Error::Invalid)?;
        bech32::encoded_length::<ProtocolBech32<5000>>(hrp, &bytes).map_err(|_| Error::Size)?;
        bech32::encode::<ProtocolBech32<5000>>(hrp, &bytes).map_err(|_| Error::Invalid)
    }
    /// Strict checksum, padding, size, and required-TLV validation.
    pub fn decode(encoded: &str) -> Result<Self> {
        if encoded.len() > 5000 {
            return Err(Error::Size);
        }
        let checked =
            CheckedHrpstring::new::<ProtocolBech32<5000>>(encoded).map_err(|_| Error::Invalid)?;
        // The byte iterator discards padding; re-encoding detects noncanonical padding.
        let bytes: Vec<u8> = checked.byte_iter().collect();
        let hrp = checked.hrp();
        if bech32::encode::<ProtocolBech32<5000>>(hrp, &bytes).map_err(|_| Error::Invalid)?
            != encoded.to_ascii_lowercase()
        {
            return Err(Error::Invalid);
        }
        let raw32 = || bytes.as_slice().try_into().map_err(|_| Error::Invalid);
        match hrp.as_str().to_ascii_lowercase().as_str() {
            "npub" => return Ok(Self::Npub(raw32()?)),
            "nsec" => return Ok(Self::Nsec(SecretKey::from_bytes(raw32()?)?)),
            "note" => return Ok(Self::Note(raw32()?)),
            "nprofile" | "nevent" | "naddr" => {}
            _ => return Err(Error::Invalid),
        }
        let t = tlv::parse(&bytes, !hrp.as_str().eq_ignore_ascii_case("nprofile"))?;
        if t.relays.iter().any(|r| !r.is_ascii()) {
            return Err(Error::Invalid);
        }
        let special = t.special.ok_or(Error::Invalid)?;
        match hrp.as_str().to_ascii_lowercase().as_str() {
            "nprofile" => Ok(Self::Profile {
                pubkey: special.try_into().map_err(|_| Error::Invalid)?,
                relays: t.relays,
            }),
            "nevent" => Ok(Self::Event {
                id: special.try_into().map_err(|_| Error::Invalid)?,
                relays: t.relays,
                author: t.author,
                kind: t.kind,
            }),
            "naddr" => Ok(Self::Address {
                identifier: String::from_utf8(special).map_err(|_| Error::Invalid)?,
                author: t.author.ok_or(Error::Invalid)?,
                kind: t.kind.ok_or(Error::Invalid)?,
                relays: t.relays,
            }),
            _ => Err(Error::Invalid),
        }
    }
    /// Parse a NIP-21 URI, rejecting secret-key links.
    pub fn from_uri(uri: &str) -> Result<Self> {
        let (scheme, value) = uri.split_once(':').ok_or(Error::Invalid)?;
        if !scheme.eq_ignore_ascii_case("nostr") {
            return Err(Error::Invalid);
        }
        let entity = Self::decode(value)?;
        if matches!(entity, Self::Nsec(_)) {
            return Err(Error::Invalid);
        }
        Ok(entity)
    }
    /// Build a NIP-21 URI. Secret keys cannot become public links.
    pub fn to_uri(&self) -> Result<String> {
        if matches!(self, Self::Nsec(_)) {
            return Err(Error::Invalid);
        }
        Ok(format!("nostr:{}", self.encode()?))
    }
}

//! Host-independent Nostr protocol support. No implicit I/O, clock, or randomness.
//!
//! ```
//! use lkjstr_nips::{event::UnsignedEvent, filter::Filter, keys::SecretKey};
//! # fn main() -> lkjstr_nips::Result<()> {
//! // Deterministic inputs are for tests only: hosts supply CSPRNG bytes.
//! let key = SecretKey::from_bytes([1; 32])?;
//! let note = UnsignedEvent::new(key.public_key(), 1700000000, 1, vec![], "hello");
//! let signed = note.sign(&key, &[2; 32])?;
//! signed.verify()?;
//! let filter: Filter = serde_json::from_str(r#"{"kinds":[1]}"#)?;
//! assert!(filter.matches(&signed)?);
//! # Ok(()) }
//! ```
#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod actions;
pub mod address;
pub mod auth;
mod bech32_checksum;
pub mod dm;
pub mod entity;
pub mod event;
pub mod filter;
pub mod gift;
pub mod gift_external;
pub mod identity;
pub mod invoice;
mod invoice_wire;
pub mod keys;
pub mod list_crypto;
pub mod lists;
pub mod metadata;
pub mod nip04;
pub mod nip44;
pub mod nip49;
pub mod relay;
pub mod scoring;
pub mod thread;
mod tlv;
pub mod zap;

/// Stable errors deliberately contain no caller input or key material.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    /// Malformed hexadecimal data.
    Hex,
    /// Invalid key or curve point.
    Key,
    /// Invalid signature.
    Signature,
    /// Event ID differs from the canonical hash.
    EventId,
    /// Malformed or unexpected JSON.
    Json,
    /// Invalid protocol encoding or structure.
    Invalid,
    /// Unsupported encryption version.
    Version,
    /// Resource or length limit exceeded.
    Size,
    /// Ciphertext authentication failed.
    Authentication,
    /// Search requires a caller-supplied matching policy.
    SearchPolicy,
    /// HTTP response is not an unredirected successful response.
    Http,
    /// An authenticated identity or target did not match.
    Identity,
}
impl core::fmt::Display for Error {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "Nostr protocol error: {self:?}")
    }
}
impl std::error::Error for Error {}
impl From<serde_json::Error> for Error {
    fn from(_: serde_json::Error) -> Self {
        Self::Json
    }
}
/// Protocol operation result.
pub type Result<T> = core::result::Result<T, Error>;

/// Lowercase hexadecimal encoding.
pub fn hex(bytes: &[u8]) -> String {
    const CHARS: &[u8; 16] = b"0123456789abcdef";
    bytes
        .iter()
        .flat_map(|b| {
            [
                CHARS[(b >> 4) as usize] as char,
                CHARS[(b & 15) as usize] as char,
            ]
        })
        .collect()
}
/// Decode exact-length lowercase hex. Uppercase protocol hex is rejected.
pub fn unhex<const N: usize>(value: &str) -> Result<[u8; N]> {
    if value.len() != N * 2 {
        return Err(Error::Hex);
    }
    let digit = |b| match b {
        b'0'..=b'9' => Ok(b - b'0'),
        b'a'..=b'f' => Ok(b - b'a' + 10),
        _ => Err(Error::Hex),
    };
    let mut result = [0; N];
    for (out, pair) in result.iter_mut().zip(value.as_bytes().as_chunks::<2>().0) {
        *out = digit(pair[0])? * 16 + digit(pair[1])?;
    }
    Ok(result)
}

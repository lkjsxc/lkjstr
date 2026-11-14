//! NIP-44 v2. Low-level decryption requires an already authenticated outer event.
//! Hosts supply a fresh CSPRNG nonce for every encryption.
//!
//! ```
//! use lkjstr_nips::{keys::SecretKey, nip44};
//! # fn main() -> lkjstr_nips::Result<()> {
//! let alice = SecretKey::from_bytes([1; 32])?;
//! let bob = SecretKey::from_bytes([2; 32])?;
//! let outgoing = nip44::conversation_key(&alice, &bob.public_bytes())?;
//! let incoming = nip44::conversation_key(&bob, &alice.public_bytes())?;
//! // Fixed nonce for this example only; use a fresh CSPRNG nonce in production.
//! let payload = nip44::encrypt("hello", &outgoing, &[3; 32])?;
//! // Authenticate the enclosing event's signature before low-level decryption.
//! assert_eq!(nip44::decrypt(&payload, &incoming)?, "hello");
//! # Ok(()) }
//! ```
use crate::{Error, Result, keys::SecretKey};
use base64::{Engine, engine::general_purpose::STANDARD};
use chacha20::{
    ChaCha20,
    cipher::{KeyIvInit, StreamCipher},
};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use zeroize::Zeroizing;

/// Platform memory limit, deliberately below the protocol's u32 maximum.
pub const MAX_PLAINTEXT: usize = 1_048_576;
/// Maximum accepted base64 payload, checked before decoding allocation.
pub const MAX_PAYLOAD: usize = (MAX_PLAINTEXT + 6 + 65).div_ceil(3) * 4;

/// Long-term ECDH/HKDF key; redacted and zeroized on drop.
pub struct ConversationKey(Zeroizing<[u8; 32]>);
impl core::fmt::Debug for ConversationKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("ConversationKey([REDACTED])")
    }
}
impl ConversationKey {
    /// Import an explicitly derived conversation key (e.g. a vector).
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(Zeroizing::new(bytes))
    }
    /// Explicit secret access, never for logging.
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}
/// Derive unhashed ECDH x-coordinate followed by HKDF-extract(nip44-v2).
pub fn conversation_key(secret: &SecretKey, peer: &[u8; 32]) -> Result<ConversationKey> {
    let private = k256::SecretKey::from_slice(secret.as_bytes()).map_err(|_| Error::Key)?;
    let mut compressed = [2; 33];
    compressed[1..].copy_from_slice(peer);
    let public = k256::PublicKey::from_sec1_bytes(&compressed).map_err(|_| Error::Key)?;
    let shared = k256::ecdh::diffie_hellman(private.to_nonzero_scalar(), public.as_affine());
    let (key, _) = Hkdf::<Sha256>::extract(Some(b"nip44-v2"), shared.raw_secret_bytes());
    Ok(ConversationKey::from_bytes(key.into()))
}
/// Per-message secret material: ChaCha key [0..32], nonce [32..44], MAC key [44..76].
pub struct MessageKeys(Zeroizing<[u8; 76]>);
impl core::fmt::Debug for MessageKeys {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("MessageKeys([REDACTED])")
    }
}
impl MessageKeys {
    /// Explicit access for cryptography and intermediate-value vector checks.
    pub fn as_bytes(&self) -> &[u8; 76] {
        &self.0
    }
}
/// HKDF-expand with exactly 76 output bytes.
pub fn message_keys(key: &ConversationKey, nonce: &[u8; 32]) -> Result<MessageKeys> {
    let hkdf = Hkdf::<Sha256>::from_prk(key.as_bytes()).map_err(|_| Error::Key)?;
    let mut keys = Zeroizing::new([0; 76]);
    hkdf.expand(nonce, keys.as_mut()).map_err(|_| Error::Key)?;
    Ok(MessageKeys(keys))
}
/// Protocol padding size, excluding prefix. Uses u64 for the 2^32 bucket.
pub fn padded_len(length: u64) -> Result<u64> {
    if length == 0 || length > u32::MAX as u64 {
        return Err(Error::Size);
    }
    if length <= 32 {
        return Ok(32);
    }
    let next = length.next_power_of_two();
    let chunk = if next <= 256 { 32 } else { next / 8 };
    Ok(length.div_ceil(chunk) * chunk)
}
fn mac(key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<Hmac<Sha256>> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).map_err(|_| Error::Key)?;
    mac.update(nonce);
    mac.update(ciphertext);
    Ok(mac)
}
fn cipher(keys: &MessageKeys, bytes: &mut [u8]) -> Result<()> {
    ChaCha20::new_from_slices(&keys.0[..32], &keys.0[32..44])
        .map_err(|_| Error::Key)?
        .try_apply_keystream(bytes)
        .map_err(|_| Error::Size)
}
/// Encrypt UTF-8 using supplied fresh CSPRNG nonce. Empty/oversize messages fail.
pub fn encrypt(plaintext: &str, key: &ConversationKey, nonce: &[u8; 32]) -> Result<String> {
    let len = plaintext.len();
    if len == 0 || len > MAX_PLAINTEXT {
        return Err(Error::Size);
    }
    let mut padded = Zeroizing::new(Vec::new());
    if len < 65536 {
        padded.extend_from_slice(&(len as u16).to_be_bytes());
    } else {
        padded.extend_from_slice(&[0, 0]);
        padded.extend_from_slice(&(len as u32).to_be_bytes());
    }
    let total = padded.len() + padded_len(len as u64)? as usize;
    padded.extend_from_slice(plaintext.as_bytes());
    padded.resize(total, 0);
    let keys = message_keys(key, nonce)?;
    cipher(&keys, &mut padded)?;
    let tag = mac(&keys.0[44..], nonce, &padded)?.finalize().into_bytes();
    let mut output = Vec::with_capacity(65 + padded.len());
    output.push(2);
    output.extend_from_slice(nonce);
    output.extend_from_slice(&padded);
    output.extend_from_slice(&tag);
    Ok(STANDARD.encode(output))
}
/// Authenticate MAC in constant time *before* decrypting, then validate padding
/// and UTF-8. Verify the enclosing NIP-01 signature before calling this API.
pub fn decrypt(payload: &str, key: &ConversationKey) -> Result<String> {
    if payload.is_empty() || payload.starts_with('#') {
        return Err(Error::Version);
    }
    if payload.len() < 132 || payload.len() > MAX_PAYLOAD {
        return Err(Error::Size);
    }
    let data = STANDARD.decode(payload).map_err(|_| Error::Invalid)?;
    if data.len() < 99 {
        return Err(Error::Size);
    }
    if data[0] != 2 {
        return Err(Error::Version);
    }
    let nonce = data[1..33].try_into().map_err(|_| Error::Invalid)?;
    let end = data.len() - 32;
    let keys = message_keys(key, nonce)?;
    mac(&keys.0[44..], nonce, &data[33..end])?
        .verify_slice(&data[end..])
        .map_err(|_| Error::Authentication)?;
    let mut padded = Zeroizing::new(data[33..end].to_vec());
    cipher(&keys, &mut padded)?;
    let short = u16::from_be_bytes([padded[0], padded[1]]) as usize;
    let (len, prefix) = if short == 0 {
        let length = u32::from_be_bytes(
            padded
                .get(2..6)
                .ok_or(Error::Invalid)?
                .try_into()
                .map_err(|_| Error::Invalid)?,
        ) as usize;
        if length < 65536 {
            return Err(Error::Invalid);
        }
        (length, 6)
    } else {
        (short, 2)
    };
    if len > MAX_PLAINTEXT || padded.len() != prefix + padded_len(len as u64)? as usize {
        return Err(Error::Invalid);
    }
    let text = padded.get(prefix..prefix + len).ok_or(Error::Invalid)?;
    // Zero-filled padding is emitted, but padding bytes carry no semantic data.
    Ok(std::str::from_utf8(text)
        .map_err(|_| Error::Invalid)?
        .to_owned())
}

//! NIP-49 version 2. Host supplies independent CSPRNG salt and nonce bytes.
//! Passwords, derived keys and in-place plaintext buffers are zeroized on drop.
use crate::{Error, Result, bech32_checksum::ProtocolBech32, keys::SecretKey};
use bech32::{Hrp, primitives::decode::CheckedHrpstring};
use chacha20poly1305::{
    Tag, XChaCha20Poly1305, XNonce,
    aead::{AeadInPlace, KeyInit},
};
use unicode_normalization::UnicodeNormalization;
use zeroize::Zeroizing;

/// Highest accepted scrypt exponent: 256 MiB for fixed r=8, p=1.
pub const MAX_LOG_N: u8 = 18;
/// Export default: 64 MiB. Callers may explicitly select 17 or 18.
pub const DEFAULT_LOG_N: u8 = 16;
/// Encoded NIP-49 version-2 length, including HRP and checksum.
pub const ENCODED_LEN: usize = 162;
/// Password bytes accepted before and after normalization.
pub const MAX_PASSWORD_BYTES: usize = 1024;

/// A validated envelope, still encrypted. Debug never prints its contents.
#[derive(Clone)]
pub struct EncryptedKey {
    bytes: [u8; 91],
}
impl core::fmt::Debug for EncryptedKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("EncryptedKey([REDACTED])")
    }
}
impl EncryptedKey {
    /// Reject malformed/overbudget inputs before any password derivation.
    pub fn parse(encoded: &str) -> Result<Self> {
        if encoded.len() != ENCODED_LEN {
            return Err(Error::Size);
        }
        let checked = CheckedHrpstring::new::<ProtocolBech32<ENCODED_LEN>>(encoded)
            .map_err(|_| Error::Invalid)?;
        if !checked.hrp().as_str().eq_ignore_ascii_case("ncryptsec") {
            return Err(Error::Invalid);
        }
        let raw = checked.byte_iter().collect::<Vec<_>>();
        let bytes: [u8; 91] = raw.try_into().map_err(|_| Error::Size)?;
        if bytes[0] != 2 {
            return Err(Error::Version);
        }
        validate_cost(bytes[1])?;
        if bytes[42] > 2 {
            return Err(Error::Invalid);
        }
        let result = Self { bytes };
        // byte_iter discards padding; canonical re-encoding rejects nonzero padding.
        if result.encode()? != encoded.to_ascii_lowercase() {
            return Err(Error::Invalid);
        }
        Ok(result)
    }
    /// Scrypt exponent carried by this envelope.
    pub fn log_n(&self) -> u8 {
        self.bytes[1]
    }
    /// 0: known exposed; 1: not known exposed; 2: unknown.
    pub fn security(&self) -> u8 {
        self.bytes[42]
    }
    /// Canonical lowercase Bech32, never Bech32m.
    pub fn encode(&self) -> Result<String> {
        bech32::encode::<ProtocolBech32<ENCODED_LEN>>(
            Hrp::parse("ncryptsec").map_err(|_| Error::Invalid)?,
            &self.bytes,
        )
        .map_err(|_| Error::Invalid)
    }
    /// Authenticate before returning a validated secp256k1 secret.
    pub fn decrypt(&self, password: &str) -> Result<SecretKey> {
        let key = derive(password, &self.bytes[2..18], self.log_n())?;
        let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref()).map_err(|_| Error::Key)?;
        let mut secret = Zeroizing::new([0u8; 32]);
        secret.copy_from_slice(&self.bytes[43..75]);
        cipher
            .decrypt_in_place_detached(
                XNonce::from_slice(&self.bytes[18..42]),
                &[self.security()],
                secret.as_mut(),
                Tag::from_slice(&self.bytes[75..91]),
            )
            .map_err(|_| Error::Authentication)?;
        SecretKey::from_bytes(*secret)
    }
}
/// Encrypt with caller-supplied entropy; production callers must not reuse it.
/// The codec accepts exponents 1..=18 for interoperable imports/test fixtures;
/// product export policy must require at least DEFAULT_LOG_N.
pub fn encrypt(
    secret: &SecretKey,
    password: &str,
    log_n: u8,
    security: u8,
    salt: &[u8; 16],
    nonce: &[u8; 24],
) -> Result<EncryptedKey> {
    validate_cost(log_n)?;
    if security > 2 {
        return Err(Error::Invalid);
    }
    let key = derive(password, salt, log_n)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_ref()).map_err(|_| Error::Key)?;
    let mut bytes = Zeroizing::new([0u8; 91]);
    bytes[0] = 2;
    bytes[1] = log_n;
    bytes[2..18].copy_from_slice(salt);
    bytes[18..42].copy_from_slice(nonce);
    bytes[42] = security;
    bytes[43..75].copy_from_slice(secret.as_bytes());
    let tag = cipher
        .encrypt_in_place_detached(XNonce::from_slice(nonce), &[security], &mut bytes[43..75])
        .map_err(|_| Error::Authentication)?;
    bytes[75..91].copy_from_slice(&tag);
    Ok(EncryptedKey { bytes: *bytes })
}
fn validate_cost(log_n: u8) -> Result<()> {
    if log_n == 0 {
        return Err(Error::Invalid);
    }
    if log_n > MAX_LOG_N {
        return Err(Error::Size);
    }
    Ok(())
}
fn derive(password: &str, salt: &[u8], log_n: u8) -> Result<Zeroizing<[u8; 32]>> {
    validate_cost(log_n)?;
    if password.len() > MAX_PASSWORD_BYTES {
        return Err(Error::Size);
    }
    let normalized = Zeroizing::new(password.nfkc().collect::<String>());
    if normalized.len() > MAX_PASSWORD_BYTES {
        return Err(Error::Size);
    }
    let params = scrypt::Params::new(log_n, 8, 1, 32).map_err(|_| Error::Invalid)?;
    let mut key = Zeroizing::new([0u8; 32]);
    scrypt::scrypt(normalized.as_bytes(), salt, &params, key.as_mut())
        .map_err(|_| Error::Invalid)?;
    Ok(key)
}

#[cfg(test)]
#[path = "nip49_test.rs"]
mod tests;

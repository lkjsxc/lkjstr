use std::fmt;

use k256::schnorr::SigningKey;
use rand_core::OsRng;

use crate::{bytes_to_hex, hex_to_bytes};

#[derive(Clone, Eq, PartialEq)]
pub struct SecretKeyBytes([u8; 32]);

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum CryptoError {
    InvalidSecretKey,
    InvalidMessageHash,
    InvalidSignature,
    InvalidPublicKey,
}

impl fmt::Debug for SecretKeyBytes {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("SecretKeyBytes(<redacted>)")
    }
}

impl SecretKeyBytes {
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

pub fn generate_secret_key() -> SecretKeyBytes {
    let signing_key = SigningKey::random(&mut OsRng);
    SecretKeyBytes(field_bytes(signing_key.to_bytes().as_slice()))
}

pub fn parse_secret_key_hex(hex: &str) -> Option<SecretKeyBytes> {
    let bytes = fixed_bytes(hex, 32).ok()?;
    SigningKey::from_bytes(&bytes).ok()?;
    Some(SecretKeyBytes(bytes))
}

pub fn public_key_from_secret(secret: &SecretKeyBytes) -> Result<String, CryptoError> {
    lkjstr_nips::keys::SecretKey::from_bytes(*secret.as_bytes())
        .map(|key| key.public_key())
        .map_err(|_| CryptoError::InvalidSecretKey)
}

pub fn public_key_from_secret_hex(hex: &str) -> Result<String, CryptoError> {
    let secret = parse_secret_key_hex(hex).ok_or(CryptoError::InvalidSecretKey)?;
    public_key_from_secret(&secret)
}

pub fn sign_schnorr_hex(
    message_hash_hex: &str,
    secret: &SecretKeyBytes,
) -> Result<String, CryptoError> {
    let message = fixed_bytes::<32>(message_hash_hex, 32)?;
    let key = lkjstr_nips::keys::SecretKey::from_bytes(*secret.as_bytes())
        .map_err(|_| CryptoError::InvalidSecretKey)?;
    let signature = key
        .sign(&message, &[0; 32])
        .map_err(|_| CryptoError::InvalidSignature)?;
    Ok(bytes_to_hex(&signature))
}

pub fn sign_schnorr_hex_with_secret_hex(
    message_hash_hex: &str,
    secret_hex: &str,
) -> Result<String, CryptoError> {
    let secret = parse_secret_key_hex(secret_hex).ok_or(CryptoError::InvalidSecretKey)?;
    sign_schnorr_hex(message_hash_hex, &secret)
}

pub fn verify_schnorr_hex(signature_hex: &str, message_hash_hex: &str, pubkey_hex: &str) -> bool {
    let (Ok(signature), Ok(message), Ok(pubkey)) = (
        fixed_bytes::<64>(signature_hex, 64),
        fixed_bytes::<32>(message_hash_hex, 32),
        fixed_bytes::<32>(pubkey_hex, 32),
    ) else {
        return false;
    };
    lkjstr_nips::keys::verify(&pubkey, &message, &signature).is_ok()
}

fn field_bytes(bytes: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    for (slot, value) in out.iter_mut().zip(bytes.iter()) {
        *slot = *value;
    }
    out
}

fn fixed_bytes<const N: usize>(hex: &str, length: usize) -> Result<[u8; N], CryptoError> {
    let bytes = hex_to_bytes(hex).map_err(|_| CryptoError::InvalidMessageHash)?;
    if bytes.len() != length {
        return Err(CryptoError::InvalidMessageHash);
    }
    bytes
        .try_into()
        .map_err(|_| CryptoError::InvalidMessageHash)
}

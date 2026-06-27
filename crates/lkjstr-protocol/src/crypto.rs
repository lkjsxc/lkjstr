use std::fmt;

use k256::schnorr::{Signature, SigningKey, VerifyingKey};
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
    let signing_key = signing_key(secret)?;
    Ok(bytes_to_hex(
        signing_key.verifying_key().to_bytes().as_slice(),
    ))
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
    let signature = signing_key(secret)?
        .sign_prehash_with_aux_rand(&message, &[0u8; 32])
        .map_err(|_| CryptoError::InvalidSignature)?;
    Ok(bytes_to_hex(signature.to_bytes().as_slice()))
}

pub fn sign_schnorr_hex_with_secret_hex(
    message_hash_hex: &str,
    secret_hex: &str,
) -> Result<String, CryptoError> {
    let secret = parse_secret_key_hex(secret_hex).ok_or(CryptoError::InvalidSecretKey)?;
    sign_schnorr_hex(message_hash_hex, &secret)
}

pub fn verify_schnorr_hex(signature_hex: &str, message_hash_hex: &str, pubkey_hex: &str) -> bool {
    let Ok(signature) = signature(signature_hex) else {
        return false;
    };
    let Ok(message) = fixed_bytes::<32>(message_hash_hex, 32) else {
        return false;
    };
    let Ok(pubkey) = fixed_bytes::<32>(pubkey_hex, 32).and_then(|bytes| {
        VerifyingKey::from_bytes(&bytes).map_err(|_| CryptoError::InvalidPublicKey)
    }) else {
        return false;
    };
    pubkey.verify_raw(&message, &signature).is_ok()
}

fn signing_key(secret: &SecretKeyBytes) -> Result<SigningKey, CryptoError> {
    SigningKey::from_bytes(&secret.0).map_err(|_| CryptoError::InvalidSecretKey)
}

fn signature(hex: &str) -> Result<Signature, CryptoError> {
    let bytes = fixed_bytes::<64>(hex, 64)?;
    Signature::try_from(bytes.as_slice()).map_err(|_| CryptoError::InvalidSignature)
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

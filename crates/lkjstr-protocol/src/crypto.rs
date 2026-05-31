use std::fmt;

use secp256k1::{Keypair, Secp256k1, SecretKey, XOnlyPublicKey, schnorr::Signature};

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
    let mut rng = secp256k1::rand::rng();
    let secret = SecretKey::new(&mut rng);
    SecretKeyBytes(secret.secret_bytes())
}

pub fn parse_secret_key_hex(hex: &str) -> Option<SecretKeyBytes> {
    let bytes = fixed_bytes(hex, 32).ok()?;
    let secret = SecretKey::from_byte_array(bytes).ok()?;
    Some(SecretKeyBytes(secret.secret_bytes()))
}

pub fn public_key_from_secret(secret: &SecretKeyBytes) -> Result<String, CryptoError> {
    let secp = Secp256k1::new();
    let secret_key =
        SecretKey::from_byte_array(secret.0).map_err(|_| CryptoError::InvalidSecretKey)?;
    let keypair = Keypair::from_secret_key(&secp, &secret_key);
    let public_key = XOnlyPublicKey::from_keypair(&keypair).0;
    Ok(bytes_to_hex(&public_key.serialize()))
}

pub fn public_key_from_secret_hex(hex: &str) -> Result<String, CryptoError> {
    let secret = parse_secret_key_hex(hex).ok_or(CryptoError::InvalidSecretKey)?;
    public_key_from_secret(&secret)
}

pub fn sign_schnorr_hex(
    message_hash_hex: &str,
    secret: &SecretKeyBytes,
) -> Result<String, CryptoError> {
    let secp = Secp256k1::new();
    let message = fixed_bytes::<32>(message_hash_hex, 32)?;
    let key = SecretKey::from_byte_array(secret.0).map_err(|_| CryptoError::InvalidSecretKey)?;
    let keypair = Keypair::from_secret_key(&secp, &key);
    Ok(secp
        .sign_schnorr_no_aux_rand(&message, &keypair)
        .to_string())
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
    let Ok(pubkey) = fixed_bytes(pubkey_hex, 32).and_then(|bytes| {
        XOnlyPublicKey::from_byte_array(bytes).map_err(|_| CryptoError::InvalidPublicKey)
    }) else {
        return false;
    };
    Secp256k1::verification_only()
        .verify_schnorr(&signature, &message, &pubkey)
        .is_ok()
}

fn signature(hex: &str) -> Result<Signature, CryptoError> {
    let bytes = fixed_bytes(hex, 64)?;
    Ok(Signature::from_byte_array(bytes))
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

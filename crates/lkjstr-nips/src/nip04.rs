//! Read-only NIP-04 compatibility. There is intentionally no encryption API.
use crate::{
    Error, Result,
    event::{Event, unique},
    keys::SecretKey,
    unhex,
};
use aes::cipher::{BlockDecryptMut, KeyIvInit, block_padding::Pkcs7};
use base64::{Engine, engine::general_purpose::STANDARD};
use zeroize::Zeroizing;

/// Determine the peer only after authenticating the legacy event and membership.
pub fn peer(event: &Event, account: &str) -> Result<String> {
    event.verify()?;
    if event.data.kind != 4 {
        return Err(Error::Invalid);
    }
    let recipient = unique(&event.data.tags, "p")?.ok_or(Error::Invalid)?;
    unhex::<32>(recipient)?;
    if event.data.pubkey == account {
        Ok(recipient.into())
    } else if recipient == account {
        Ok(event.data.pubkey.clone())
    } else {
        Err(Error::Identity)
    }
}
/// Decrypt authenticated legacy content with the raw ECDH x coordinate.
pub fn decrypt(payload: &str, secret: &SecretKey, peer: &[u8; 32]) -> Result<String> {
    if payload.len() > 1_400_000 {
        return Err(Error::Size);
    }
    let (content, iv) = payload.split_once("?iv=").ok_or(Error::Invalid)?;
    let iv = STANDARD.decode(iv).map_err(|_| Error::Invalid)?;
    if iv.len() != 16 {
        return Err(Error::Invalid);
    }
    let private = k256::SecretKey::from_slice(secret.as_bytes()).map_err(|_| Error::Key)?;
    let mut compressed = [2; 33];
    compressed[1..].copy_from_slice(peer);
    let public = k256::PublicKey::from_sec1_bytes(&compressed).map_err(|_| Error::Key)?;
    let shared = k256::ecdh::diffie_hellman(private.to_nonzero_scalar(), public.as_affine());
    let mut bytes = Zeroizing::new(STANDARD.decode(content).map_err(|_| Error::Invalid)?);
    let plaintext = cbc::Decryptor::<aes::Aes256>::new_from_slices(shared.raw_secret_bytes(), &iv)
        .map_err(|_| Error::Invalid)?
        .decrypt_padded_mut::<Pkcs7>(&mut bytes)
        .map_err(|_| Error::Authentication)?;
    Ok(std::str::from_utf8(plaintext)
        .map_err(|_| Error::Invalid)?
        .to_owned())
}

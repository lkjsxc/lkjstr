//! NIP-51 private list entries, encrypted to the owner's own key with NIP-44.
use crate::{
    Error, Result,
    event::{Event, Tag},
    keys::SecretKey,
    lists::List,
    nip44,
};
use zeroize::Zeroizing;

/// Encrypt private entries using a fresh nonce supplied by the host.
pub fn encrypt(entries: &[Tag], owner: &SecretKey, nonce: &[u8; 32]) -> Result<String> {
    if entries.iter().any(Vec::is_empty) {
        return Err(Error::Invalid);
    }
    let text = Zeroizing::new(serde_json::to_string(entries)?);
    let key = nip44::conversation_key(owner, &owner.public_bytes())?;
    nip44::encrypt(&text, &key, nonce)
}
/// Verify a signed list before decrypting its private entries. An empty content
/// field means no private entries; unsupported historical formats fail explicitly.
pub fn decrypt(event: &Event, owner: &SecretKey) -> Result<Vec<Tag>> {
    event.verify()?;
    List::parse(&event.data)?;
    if event.data.pubkey != owner.public_key() {
        return Err(Error::Identity);
    }
    if event.data.content.is_empty() {
        return Ok(vec![]);
    }
    let key = nip44::conversation_key(owner, &owner.public_bytes())?;
    let text = Zeroizing::new(nip44::decrypt(&event.data.content, &key)?);
    List::private_entries(&text, nip44::MAX_PLAINTEXT)
}

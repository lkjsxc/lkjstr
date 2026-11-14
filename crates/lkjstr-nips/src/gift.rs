//! NIP-59 authenticated gift wrapping. Rumors are deliberately never signed.
use crate::{
    Error, Result,
    event::{Event, Rumor, UnsignedEvent, unique},
    keys::SecretKey,
    nip44, unhex,
};
use zeroize::Zeroizing;

/// All wrapping entropy/time comes from the host. Do not reuse ephemeral keys.
pub struct WrapParameters<'a> {
    /// Fresh single-use secret key for this recipient's outer wrapper.
    pub ephemeral: &'a SecretKey,
    /// Current Unix seconds.
    pub now: u64,
    /// Independent random age in `[0,172800)` for the seal.
    pub seal_age: u32,
    /// Independent random age in `[0,172800)` for the wrapper.
    pub wrap_age: u32,
    /// Fresh CSPRNG seal nonce.
    pub seal_nonce: [u8; 32],
    /// Fresh CSPRNG wrapper nonce.
    pub wrap_nonce: [u8; 32],
    /// Schnorr auxiliary randomness for seal signature.
    pub seal_aux: [u8; 32],
    /// Schnorr auxiliary randomness for wrap signature.
    pub wrap_aux: [u8; 32],
}
/// Seal and gift-wrap to one recipient. Call separately for every recipient.
pub fn wrap(
    rumor: &Rumor,
    author: &SecretKey,
    recipient: &[u8; 32],
    params: &WrapParameters<'_>,
) -> Result<Event> {
    rumor.verify_id()?;
    if rumor.data.pubkey != author.public_key() {
        return Err(Error::Identity);
    }
    if params.seal_age >= 172800 || params.wrap_age >= 172800 {
        return Err(Error::Invalid);
    }
    let text = Zeroizing::new(serde_json::to_string(rumor)?);
    let key = nip44::conversation_key(author, recipient)?;
    let content = nip44::encrypt(&text, &key, &params.seal_nonce)?;
    let seal = UnsignedEvent::new(
        author.public_key(),
        params.now.saturating_sub(params.seal_age as u64),
        13,
        vec![],
        content,
    )
    .sign(author, &params.seal_aux)?;
    let outer_key = nip44::conversation_key(params.ephemeral, recipient)?;
    let sealed_json = Zeroizing::new(seal.to_json()?);
    let content = nip44::encrypt(&sealed_json, &outer_key, &params.wrap_nonce)?;
    UnsignedEvent::new(
        params.ephemeral.public_key(),
        params.now.saturating_sub(params.wrap_age as u64),
        1059,
        vec![vec!["p".into(), crate::hex(recipient)]],
        content,
    )
    .sign(params.ephemeral, &params.wrap_aux)
}
/// Unwrap, authenticating both signatures, the recipient, rumor hash, and author
/// equality. Reject signed rumors to preserve the protocol's deniability model.
pub fn unwrap(event: &Event, recipient: &SecretKey) -> Result<Rumor> {
    event.verify()?;
    if !matches!(event.data.kind, 1059 | 21059) {
        return Err(Error::Invalid);
    }
    if unique(&event.data.tags, "p")? != Some(recipient.public_key().as_str()) {
        return Err(Error::Identity);
    }
    let key = nip44::conversation_key(recipient, &unhex(&event.data.pubkey)?)?;
    let text = Zeroizing::new(nip44::decrypt(&event.data.content, &key)?);
    let seal = Event::parse(&text, nip44::MAX_PLAINTEXT)?;
    if seal.data.kind != 13 || !seal.data.tags.is_empty() {
        return Err(Error::Invalid);
    }
    let key = nip44::conversation_key(recipient, &unhex(&seal.data.pubkey)?)?;
    let text = Zeroizing::new(nip44::decrypt(&seal.data.content, &key)?);
    let value: serde_json::Value = serde_json::from_str(&text)?;
    if value.get("sig").is_some() {
        return Err(Error::Invalid);
    }
    let rumor: Rumor = serde_json::from_value(value)?;
    rumor.verify_id()?;
    if rumor.data.pubkey != seal.data.pubkey {
        return Err(Error::Identity);
    }
    Ok(rumor)
}

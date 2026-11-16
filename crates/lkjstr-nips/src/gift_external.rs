//! Split NIP-59 checks for external signers. Plaintext never bypasses authentication.
use crate::{
    Error, Result,
    event::{Event, Rumor, UnsignedEvent, unique},
    gift::WrapParameters,
    nip44, unhex,
};
use zeroize::Zeroizing;

/// Validate the outer layer before asking a signer to decrypt it.
pub fn outer(event: &Event, recipient: &str) -> Result<()> {
    event.verify()?;
    if !matches!(event.data.kind, 1059 | 21059) || unique(&event.data.tags, "p")? != Some(recipient)
    {
        return Err(Error::Identity);
    }
    unhex::<32>(recipient)?;
    Ok(())
}
/// Parse and authenticate a decrypted seal before requesting inner decryption.
pub fn seal(plaintext: &str) -> Result<Event> {
    let event = Event::parse(plaintext, nip44::MAX_PLAINTEXT)?;
    if event.data.kind != 13 || !event.data.tags.is_empty() {
        return Err(Error::Invalid);
    }
    Ok(event)
}
/// Bind the unsigned rumor to its verified seal and the receiving participant.
pub fn rumor(seal: &Event, plaintext: &str, recipient: &str) -> Result<Rumor> {
    seal.verify()?;
    if seal.data.kind != 13 || !seal.data.tags.is_empty() || plaintext.len() > nip44::MAX_PLAINTEXT
    {
        return Err(Error::Invalid);
    }
    let value: serde_json::Value = serde_json::from_str(plaintext)?;
    if value.get("sig").is_some() {
        return Err(Error::Invalid);
    }
    let rumor: Rumor = serde_json::from_value(value)?;
    rumor.verify_id()?;
    if rumor.data.pubkey != seal.data.pubkey
        || !crate::dm::participants(&rumor)?.contains(recipient)
    {
        return Err(Error::Identity);
    }
    Ok(rumor)
}
/// Make a seal after the author's signer encrypted the authenticated rumor.
pub fn unsigned_seal(
    rumor: &Rumor,
    recipient: &str,
    content: String,
    now: u64,
    age: u32,
) -> Result<UnsignedEvent> {
    if age >= 172800
        || !crate::dm::participants(rumor)?.contains(recipient)
        || content.len() < 132
        || content.len() > nip44::MAX_PAYLOAD
    {
        return Err(Error::Invalid);
    }
    Ok(UnsignedEvent::new(
        rumor.data.pubkey.clone(),
        now.saturating_sub(u64::from(age)),
        13,
        vec![],
        content,
    ))
}
/// The ephemeral outer key always stays in the Worker, even for an external signer.
pub fn wrap_seal(seal: &Event, recipient: &[u8; 32], params: &WrapParameters<'_>) -> Result<Event> {
    seal.verify()?;
    if seal.data.kind != 13 || !seal.data.tags.is_empty() || params.wrap_age >= 172800 {
        return Err(Error::Invalid);
    }
    let key = nip44::conversation_key(params.ephemeral, recipient)?;
    let text = Zeroizing::new(seal.to_json()?);
    let content = nip44::encrypt(&text, &key, &params.wrap_nonce)?;
    UnsignedEvent::new(
        params.ephemeral.public_key(),
        params.now.saturating_sub(u64::from(params.wrap_age)),
        1059,
        vec![vec!["p".into(), crate::hex(recipient)]],
        content,
    )
    .sign(params.ephemeral, &params.wrap_aux)
}

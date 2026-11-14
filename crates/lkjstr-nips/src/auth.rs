//! NIP-42 authentication events are sent as AUTH, never published as EVENT.
use crate::{
    Error, Result,
    event::{Event, UnsignedEvent, unique},
    keys::SecretKey,
    relay::relay_url,
};

/// Construct a signed AUTH event using explicit time and Schnorr randomness.
pub fn event(
    secret: &SecretKey,
    relay: &str,
    challenge: &str,
    now: u64,
    auxiliary: &[u8; 32],
) -> Result<Event> {
    relay_url(relay)?;
    UnsignedEvent::new(
        secret.public_key(),
        now,
        22242,
        vec![
            vec!["relay".into(), relay.into()],
            vec!["challenge".into(), challenge.into()],
        ],
        "",
    )
    .sign(secret, auxiliary)
}
/// Serialize the correct client-relay message.
pub fn message(event: &Event) -> Result<String> {
    if event.data.kind != 22242 {
        return Err(Error::Invalid);
    }
    event.verify()?;
    Ok(serde_json::to_string(&("AUTH", event))?)
}
/// Validate challenge, normalized relay URL, kind, signature and clock window.
pub fn verify(event: &Event, relay: &str, challenge: &str, now: u64, tolerance: u64) -> Result<()> {
    event.verify()?;
    if event.data.kind != 22242
        || !event.data.content.is_empty()
        || event.data.created_at.abs_diff(now) > tolerance
        || unique(&event.data.tags, "challenge")? != Some(challenge)
    {
        return Err(Error::Invalid);
    }
    let tagged = unique(&event.data.tags, "relay")?.ok_or(Error::Invalid)?;
    if relay_url(tagged)? != relay_url(relay)? {
        return Err(Error::Identity);
    }
    Ok(())
}

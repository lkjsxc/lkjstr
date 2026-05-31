use crate::{
    NostrEvent, NostrTag, SecretKeyBytes, UnsignedNostrEvent, compute_event_id,
    public_key_from_secret, sign_schnorr_hex,
};

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct EventTemplate {
    pub pubkey: Option<String>,
    pub created_at: u64,
    pub kind: u64,
    pub tags: Vec<NostrTag>,
    pub content: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum SignError {
    PubkeyMismatch,
    InvalidSecretKey,
    InvalidEventId,
    InvalidSignature,
}

pub fn finalize_event(
    template: &EventTemplate,
    secret: &SecretKeyBytes,
) -> Result<NostrEvent, SignError> {
    let pubkey = public_key_from_secret(secret).map_err(|_| SignError::InvalidSecretKey)?;
    if template
        .pubkey
        .as_ref()
        .is_some_and(|value| value != &pubkey)
    {
        return Err(SignError::PubkeyMismatch);
    }
    let unsigned = UnsignedNostrEvent {
        pubkey,
        created_at: template.created_at,
        kind: template.kind,
        tags: template.tags.clone(),
        content: template.content.clone(),
    };
    let id = compute_event_id(&unsigned).map_err(|_| SignError::InvalidEventId)?;
    let sig = sign_schnorr_hex(&id, secret).map_err(|_| SignError::InvalidSignature)?;
    Ok(NostrEvent {
        id,
        sig,
        pubkey: unsigned.pubkey,
        created_at: unsigned.created_at,
        kind: unsigned.kind,
        tags: unsigned.tags,
        content: unsigned.content,
    })
}

pub fn sign_event_with_secret_hex(
    event: &UnsignedNostrEvent,
    secret_hex: &str,
) -> Result<NostrEvent, SignError> {
    let template = EventTemplate {
        pubkey: Some(event.pubkey.clone()),
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags.clone(),
        content: event.content.clone(),
    };
    let secret = crate::parse_secret_key_hex(secret_hex).ok_or(SignError::InvalidSecretKey)?;
    finalize_event(&template, &secret)
}

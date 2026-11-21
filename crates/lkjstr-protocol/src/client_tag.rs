use lkjstr_nips::address::Coordinate;
use serde::{Deserialize, Serialize};

use crate::{
    NostrTag, is_pubkey,
    kinds::{KIND_BLOSSOM_AUTH, KIND_HANDLER_INFORMATION, KIND_HTTP_AUTH, KIND_RELAY_AUTH},
    normalize_relay_url,
};

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
pub enum ClientTagPolicy {
    Disabled,
    Enabled,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ClientTagConfig {
    pub policy: ClientTagPolicy,
    pub name: String,
    pub address: String,
    pub relay: String,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ClientTag {
    pub name: String,
    pub address: String,
    pub relay: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum ClientTagError {
    Disabled,
    EmptyName,
    BadAddress,
    BadRelay,
    ForbiddenKind,
}

pub fn parse_client_tag(tags: &[NostrTag]) -> Option<ClientTag> {
    tags.iter()
        .find(|tag| tag.first().is_some_and(|name| name == "client"))
        .and_then(|tag| {
            let config = ClientTagConfig {
                policy: ClientTagPolicy::Enabled,
                name: tag.get(1)?.clone(),
                address: tag.get(2)?.clone(),
                relay: tag.get(3)?.clone(),
            };
            client_tag(&config).ok()
        })
}

/// Read a tag even when it has only a name, or its coordinate or relay is invalid.
pub fn client_attribution(tags: &[NostrTag]) -> Option<(&str, Option<Coordinate>)> {
    let tag = tags
        .iter()
        .find(|tag| tag.first().is_some_and(|key| key == "client"))?;
    let name = tag.get(1)?.as_str();
    if name.trim().is_empty() {
        return None;
    }
    Some((
        name,
        tag.get(2).and_then(|value| client_handler_address(value)),
    ))
}

/// Parse a bounded kind-31990 coordinate without changing the case or spacing of its d tag.
pub fn client_handler_address(address: &str) -> Option<Coordinate> {
    if address.len() > 512 || address.chars().any(char::is_control) {
        return None;
    }
    let mut parts = address.splitn(3, ':');
    if parts.next()? != "31990" {
        return None;
    }
    let pubkey = parts.next()?.to_ascii_lowercase();
    let identifier = parts.next()?;
    if !is_pubkey(&pubkey) || identifier.trim().is_empty() {
        return None;
    }
    Some(Coordinate {
        kind: KIND_HANDLER_INFORMATION as u16,
        pubkey,
        identifier: identifier.to_owned(),
    })
}

pub fn client_tag(config: &ClientTagConfig) -> Result<ClientTag, ClientTagError> {
    if config.policy == ClientTagPolicy::Disabled {
        return Err(ClientTagError::Disabled);
    }
    let name = config.name.trim();
    if name.is_empty() {
        return Err(ClientTagError::EmptyName);
    }
    let address = normalize_handler_address(&config.address)?;
    let relay = normalize_relay_url(&config.relay).ok_or(ClientTagError::BadRelay)?;
    Ok(ClientTag {
        name: name.to_owned(),
        address,
        relay,
    })
}

pub fn client_tag_parts(config: &ClientTagConfig) -> Result<NostrTag, ClientTagError> {
    client_tag(config).map(|tag| vec!["client".to_owned(), tag.name, tag.address, tag.relay])
}

pub fn append_client_tag(
    tags: Vec<NostrTag>,
    config: &ClientTagConfig,
    event_kind: u64,
) -> Vec<NostrTag> {
    let mut out: Vec<NostrTag> = tags
        .into_iter()
        .filter(|tag| tag.first().is_none_or(|name| name != "client"))
        .collect();
    if !client_tag_allowed_for_kind(event_kind) {
        return out;
    }
    if let Ok(tag) = client_tag_parts(config) {
        out.push(tag);
    }
    out
}

pub fn client_tag_allowed_for_kind(kind: u64) -> bool {
    if matches!(kind, KIND_HTTP_AUTH | KIND_RELAY_AUTH | KIND_BLOSSOM_AUTH) {
        return false;
    }
    !(20_000..30_000).contains(&kind)
}

fn normalize_handler_address(address: &str) -> Result<String, ClientTagError> {
    let mut parts = address.trim().splitn(3, ':');
    let Some(kind) = parts.next() else {
        return Err(ClientTagError::BadAddress);
    };
    let Some(pubkey) = parts.next() else {
        return Err(ClientTagError::BadAddress);
    };
    let Some(identifier) = parts.next().map(str::trim).filter(|item| !item.is_empty()) else {
        return Err(ClientTagError::BadAddress);
    };
    if kind.parse::<u64>().ok() != Some(KIND_HANDLER_INFORMATION) {
        return Err(ClientTagError::BadAddress);
    }
    let pubkey = pubkey.to_ascii_lowercase();
    if !is_pubkey(&pubkey) {
        return Err(ClientTagError::BadAddress);
    }
    Ok(format!("{KIND_HANDLER_INFORMATION}:{pubkey}:{identifier}"))
}

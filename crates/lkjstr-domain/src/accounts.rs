use serde::{Deserialize, Serialize};

use lkjstr_protocol::{NostrEntity, decode_nip19, encode_npub, is_pubkey};

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SignerType {
    Readonly,
    Nip07,
    Local,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct AccountCapabilities {
    pub read: bool,
    pub sign: bool,
    pub publish: bool,
    pub decrypt: bool,
    pub wallet: bool,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub pubkey: String,
    pub npub: String,
    pub label: String,
    pub enabled: bool,
    pub signer_type: SignerType,
    pub capabilities: AccountCapabilities,
    pub default_relay_group_id: Option<String>,
    pub profile_event_id: Option<String>,
    pub avatar_url: Option<String>,
    pub display_name: Option<String>,
    pub nip05: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub last_used_at: Option<u64>,
}

pub fn create_account(pubkey: &str, signer_type: SignerType, timestamp: u64) -> Option<Account> {
    let pubkey = parse_pubkey(pubkey)?;
    let label = short_key(&pubkey);
    Some(create_labeled_account(
        &pubkey,
        signer_type,
        &label,
        timestamp,
    ))
}

pub fn create_labeled_account(
    pubkey: &str,
    signer_type: SignerType,
    label: &str,
    timestamp: u64,
) -> Account {
    Account {
        id: format!("{}:{pubkey}", signer_type_key(signer_type)),
        pubkey: pubkey.to_owned(),
        npub: encode_npub(pubkey).unwrap_or_else(|_| pubkey.to_owned()),
        label: label.to_owned(),
        enabled: true,
        signer_type,
        capabilities: capabilities_for(signer_type),
        default_relay_group_id: None,
        profile_event_id: None,
        avatar_url: None,
        display_name: None,
        nip05: None,
        created_at: timestamp,
        updated_at: timestamp,
        last_used_at: None,
    }
}

pub fn normalize_account(account: &Account) -> Account {
    Account {
        enabled: true,
        capabilities: capabilities_for(account.signer_type),
        ..account.clone()
    }
}

pub fn parse_readonly_account(input: &str, timestamp: u64) -> Option<Account> {
    create_account(&parse_pubkey(input)?, SignerType::Readonly, timestamp)
}

pub fn parse_pubkey(input: &str) -> Option<String> {
    let trimmed = input.trim().to_ascii_lowercase();
    if let Some(NostrEntity::Npub(pubkey)) = decode_nip19(&trimmed) {
        return Some(pubkey);
    }
    if is_pubkey(&trimmed) {
        Some(trimmed)
    } else {
        None
    }
}

pub fn short_key(pubkey: &str) -> String {
    let start = pubkey.get(0..8).unwrap_or(pubkey);
    let end_start = pubkey.len().saturating_sub(6);
    let end = pubkey.get(end_start..).unwrap_or(pubkey);
    format!("{start}:{end}")
}

pub fn signer_type_key(signer_type: SignerType) -> &'static str {
    match signer_type {
        SignerType::Readonly => "readonly",
        SignerType::Nip07 => "nip07",
        SignerType::Local => "local",
    }
}

pub fn capabilities_for(signer_type: SignerType) -> AccountCapabilities {
    let can_sign = matches!(signer_type, SignerType::Nip07 | SignerType::Local);
    AccountCapabilities {
        read: true,
        sign: can_sign,
        publish: can_sign,
        decrypt: can_sign,
        wallet: false,
    }
}

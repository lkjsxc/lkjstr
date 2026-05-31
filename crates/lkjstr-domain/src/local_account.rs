use serde::{Deserialize, Serialize};

use lkjstr_protocol::{
    NostrEntity, NostrEvent, SecretKeyBytes, UnsignedNostrEvent, bytes_to_hex, decode_nip19,
    encode_nsec, generate_secret_key, parse_secret_key_hex, public_key_from_secret,
    sign_event_with_secret_hex,
};

use crate::accounts::{Account, SignerType, create_labeled_account};

#[derive(Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAccountSecret {
    pub account_id: String,
    pub pubkey: String,
    pub secret_key: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum LocalAccountError {
    InvalidSecret,
    SignFailed,
}

impl std::fmt::Debug for LocalAccountSecret {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("LocalAccountSecret")
            .field("account_id", &self.account_id)
            .field("pubkey", &self.pubkey)
            .field("secret_key", &"<redacted>")
            .field("created_at", &self.created_at)
            .field("updated_at", &self.updated_at)
            .finish()
    }
}

pub fn create_local_account_record(
    secret: Option<&SecretKeyBytes>,
    timestamp: u64,
) -> Result<(Account, LocalAccountSecret), LocalAccountError> {
    let generated;
    let secret = match secret {
        Some(secret) => secret,
        None => {
            generated = generate_secret_key();
            &generated
        }
    };
    let pubkey = public_key_from_secret(secret).map_err(|_| LocalAccountError::InvalidSecret)?;
    let account = create_labeled_account(
        &pubkey,
        SignerType::Local,
        &format!("Local {}", &pubkey[0..8]),
        timestamp,
    );
    let secret_row = LocalAccountSecret {
        account_id: account.id.clone(),
        pubkey,
        secret_key: bytes_to_hex(secret.as_bytes()),
        created_at: timestamp,
        updated_at: timestamp,
    };
    Ok((account, secret_row))
}

pub fn generate_nsec() -> String {
    let secret = generate_secret_key();
    encode_nsec(&bytes_to_hex(secret.as_bytes())).unwrap_or_default()
}

pub fn parse_nsec(input: &str) -> Option<SecretKeyBytes> {
    let decoded = decode_nip19(input.trim())?;
    let NostrEntity::Nsec(secret_hex) = decoded else {
        return None;
    };
    parse_secret_key_hex(&secret_hex)
}

pub fn sign_local_event(
    event: &UnsignedNostrEvent,
    secret_key: &str,
) -> Result<NostrEvent, LocalAccountError> {
    sign_event_with_secret_hex(event, secret_key).map_err(|_| LocalAccountError::SignFailed)
}

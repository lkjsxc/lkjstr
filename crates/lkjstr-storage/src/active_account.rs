#![doc = "Active-account selector row helpers."]

use lkjstr_domain::SignerType;
use serde::{Deserialize, Serialize};

use crate::{AccountRecord, SqliteSettingRow, signer_kind};

pub const ACTIVE_ACCOUNT_SELECTOR_KEY: &str = "accounts.activeAccountSelector";
pub const ACTIVE_ACCOUNT_SELECTOR_SCOPE: &str = "default";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ActiveAccountSelectorRecord {
    pub scope: String,
    pub selected_account_id: Option<String>,
    pub selected_pubkey: Option<String>,
    pub signer_kind: Option<String>,
    pub read_only_state: String,
    pub local_signer_state: String,
    pub nip07_availability: String,
    pub updated_at_ms: u64,
}

pub type SqliteActiveAccountSelectorRow = SqliteSettingRow;

impl ActiveAccountSelectorRecord {
    #[must_use]
    pub fn empty(updated_at_ms: u64) -> Self {
        Self {
            scope: ACTIVE_ACCOUNT_SELECTOR_SCOPE.to_owned(),
            selected_account_id: None,
            selected_pubkey: None,
            signer_kind: None,
            read_only_state: "none".to_owned(),
            local_signer_state: "none".to_owned(),
            nip07_availability: "unknown".to_owned(),
            updated_at_ms,
        }
    }

    #[must_use]
    pub fn for_account(
        account: &AccountRecord,
        local_secret_available: bool,
        nip07_availability: impl Into<String>,
        updated_at_ms: u64,
    ) -> Self {
        Self {
            scope: ACTIVE_ACCOUNT_SELECTOR_SCOPE.to_owned(),
            selected_account_id: Some(account.id.clone()),
            selected_pubkey: Some(account.pubkey.clone()),
            signer_kind: Some(signer_kind(account.signer_type).to_owned()),
            read_only_state: read_only_state(account.signer_type).to_owned(),
            local_signer_state: local_signer_state(account.signer_type, local_secret_available)
                .to_owned(),
            nip07_availability: nip07_availability.into(),
            updated_at_ms,
        }
    }
}

#[must_use]
pub const fn active_account_selector_key() -> &'static str {
    ACTIVE_ACCOUNT_SELECTOR_KEY
}

pub fn active_account_selector_json_bytes(
    row: &ActiveAccountSelectorRecord,
) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_active_account_selector_row(
    row: &ActiveAccountSelectorRecord,
) -> Result<SqliteActiveAccountSelectorRow, serde_json::Error> {
    Ok(SqliteSettingRow {
        key: ACTIVE_ACCOUNT_SELECTOR_KEY.to_owned(),
        value_json: serde_json::to_string(row)?,
        updated_at_ms: row.updated_at_ms,
    })
}

pub fn active_account_selector_from_sqlite_row(
    row: &SqliteActiveAccountSelectorRow,
) -> Result<ActiveAccountSelectorRecord, serde_json::Error> {
    serde_json::from_str(&row.value_json)
}

const fn read_only_state(signer_type: SignerType) -> &'static str {
    match signer_type {
        SignerType::Readonly => "read-only",
        SignerType::Local | SignerType::Nip07 => "signing",
    }
}

const fn local_signer_state(signer_type: SignerType, secret_available: bool) -> &'static str {
    match (signer_type, secret_available) {
        (SignerType::Local, true) => "secret-present",
        (SignerType::Local, false) => "secret-missing",
        (SignerType::Nip07 | SignerType::Readonly, _) => "not-local",
    }
}

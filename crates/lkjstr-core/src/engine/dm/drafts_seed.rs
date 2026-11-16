//! The signer wraps only a purpose- and account-bound random local archive seed.
use super::{PURPOSE, storage_key};
use crate::engine::accounts::secret::SecretText;
use lkjstr_nips::nip44::ConversationKey;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

pub struct PreparedSeed {
    pub key: ConversationKey,
    pub payload: SecretText,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Seed {
    schema: u32,
    purpose: String,
    account: String,
    seed: SecretText,
}
pub fn prepare_seed(account: &str, bytes: [u8; 32]) -> Result<PreparedSeed, &'static str> {
    storage_key(account)?;
    let bytes = Zeroizing::new(bytes);
    let value = Seed {
        schema: 1,
        purpose: PURPOSE.into(),
        account: account.into(),
        seed: SecretText::new(lkjstr_nips::hex(bytes.as_ref())),
    };
    Ok(PreparedSeed {
        key: ConversationKey::from_bytes(*bytes),
        payload: SecretText::new(serde_json::to_string(&value).map_err(|_| "internal")?),
    })
}
pub fn open_seed(account: &str, raw: &str) -> Result<ConversationKey, &'static str> {
    storage_key(account)?;
    if raw.len() > 1024 {
        return Err("too-large");
    }
    let value: Seed = serde_json::from_str(raw).map_err(|_| "rejected")?;
    if value.schema != 1 || value.purpose != PURPOSE || value.account != account {
        return Err("rejected");
    }
    let bytes = Zeroizing::new(lkjstr_nips::unhex::<32>(&value.seed).map_err(|_| "rejected")?);
    Ok(ConversationKey::from_bytes(*bytes))
}

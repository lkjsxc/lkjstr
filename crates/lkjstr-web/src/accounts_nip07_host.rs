use lkjstr_domain::{SignerType, create_account};
use lkjstr_storage::AccountRecord;

use crate::{host_status::browser_now_ms, nip07_host::nip07_public_key};

pub async fn nip07_account() -> Result<AccountRecord, String> {
    let pubkey = nip07_public_key().await?;
    create_account(&pubkey, SignerType::Nip07, browser_now_ms())
        .ok_or_else(|| "NIP-07 signer returned an invalid public key.".to_owned())
}

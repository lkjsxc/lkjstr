//! Explicit key operations. All vault mutations share the account transaction queue.
use super::*;
use lkjstr_core::engine::wire::{Input as I, Output as O, Session, actions::Action as A};

pub(super) fn receive(h: &mut Host, id: u64, input: I) -> Option<I> {
    match input {
        I::Act {
            req,
            action: A::AccountKey { pubkey },
        } => {
            let result = match h.accounts.backup_key(&pubkey) {
                Ok(key) => O::Result {
                    req,
                    ok: true,
                    error: None,
                    delivery: None,
                    id: None,
                    uploaded: None,
                    key: Some(key),
                    encrypted_key: None,
                },
                Err(code) => Session::failure(req, code),
            };
            h.scope.direct(id, &result);
            None
        }
        I::Act { req, action } if is_vault(&action) => {
            let password = match &action {
                A::AccountImportEncrypted { password, .. }
                | A::AccountUnlock { password, .. }
                | A::AccountExportEncrypted { password, .. } => Some(password),
                _ => None,
            };
            if h.account_tasks.len() >= 32
                || password.is_some_and(|p| p.len() > lkjstr_nips::nip49::MAX_PASSWORD_BYTES)
            {
                h.scope.direct(id, &Session::failure(req, "too-large"));
            } else {
                h.account_tasks.push((id, req, action));
            }
            None
        }
        other => Some(other),
    }
}
pub(super) fn is_vault(action: &A) -> bool {
    matches!(
        action,
        A::AccountImportEncrypted { .. }
            | A::AccountUnlock { .. }
            | A::AccountLock { .. }
            | A::AccountExportEncrypted { .. }
    )
}
pub(super) fn apply(
    accounts: &mut lkjstr_core::engine::accounts::Accounts,
    action: &A,
) -> Result<Option<String>, &'static str> {
    match action {
        A::AccountImportEncrypted { key, password } => {
            accounts.import_encrypted(key, password).map(|_| None)
        }
        A::AccountUnlock { pubkey, password } => accounts.unlock(pubkey, password).map(|_| None),
        A::AccountLock { pubkey } => accounts.lock(pubkey).map(|_| None),
        A::AccountExportEncrypted {
            pubkey,
            password,
            log_n,
        } => accounts
            .export_encrypted(
                pubkey,
                password,
                log_n.unwrap_or(lkjstr_nips::nip49::DEFAULT_LOG_N),
                &crate::browser::random_bytes()?,
                &crate::browser::random_bytes()?,
            )
            .map(Some),
        _ => Err("unsupported"),
    }
}

//! Accounts and signing. Local secrets live in IndexedDB under
//! `secret:<pubkey>` and leave it only through `reveal_nsec`, an explicit
//! user action. They are never logged.

use std::collections::HashMap;

use lkjstr_core::plan::Want;
use lkjstr_protocol::{is_pubkey, public_key_from_secret_hex};
use serde::{Deserialize, Serialize};
use web_sys::IdbDatabase;

use super::{Rt, default_relays};
use crate::host::idb;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Signer {
    Local,
    Extension,
    ReadOnly,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Account {
    pub pubkey: String,
    pub signer: Signer,
}

#[derive(Default, Serialize, Deserialize)]
struct Saved {
    accounts: Vec<Account>,
    active: Option<String>,
}

#[derive(Default)]
pub struct Session {
    pub accounts: Vec<Account>,
    pub active: Option<String>,
    pub(super) secrets: HashMap<String, String>,
    want: Option<u32>,
}

impl Session {
    pub fn restore(&mut self, saved: Option<&str>, secrets: Vec<(String, String)>) {
        let saved: Saved = saved
            .and_then(|text| serde_json::from_str(text).ok())
            .unwrap_or_default();
        self.accounts = saved.accounts;
        self.active = saved
            .active
            .filter(|pk| self.accounts.iter().any(|a| &a.pubkey == pk));
        self.secrets = secrets.into_iter().collect();
    }

    pub fn active_account(&self) -> Option<&Account> {
        let active = self.active.as_ref()?;
        self.accounts
            .iter()
            .find(|account| &account.pubkey == active)
    }

    pub fn can_sign(&self) -> bool {
        self.active_account()
            .is_some_and(|account| match account.signer {
                Signer::Local => self.secrets.contains_key(&account.pubkey),
                Signer::Extension => true,
                Signer::ReadOnly => false,
            })
    }

    pub(super) fn local_secret(&self) -> Option<&str> {
        let account = self.active_account()?;
        (account.signer == Signer::Local)
            .then(|| self.secrets.get(&account.pubkey).map(String::as_str))
            .flatten()
    }

    fn saved_json(&self) -> String {
        serde_json::to_string(&Saved {
            accounts: self.accounts.clone(),
            active: self.active.clone(),
        })
        .unwrap_or_default()
    }
}

pub(super) async fn load_secrets(db: &IdbDatabase, saved: &str) -> Vec<(String, String)> {
    let saved: Saved = serde_json::from_str(saved).unwrap_or_default();
    let mut out = Vec::new();
    for account in saved.accounts.iter().filter(|a| a.signer == Signer::Local) {
        let key = format!("secret:{}", account.pubkey);
        if let Ok(Some(secret)) = idb::kv_get(db, &key).await {
            out.push((account.pubkey.clone(), secret));
        }
    }
    out
}

impl Rt {
    /// Reads go to the active account's NIP-65 read relays first, then the
    /// app defaults; the account's own metadata is kept fresh.
    pub(super) fn apply_session_relays(&mut self) {
        let mut defaults = default_relays();
        if let Some(active) = self.session.active.clone() {
            let own: Vec<String> = self
                .store
                .relay_list(&active)
                .unwrap_or_default()
                .into_iter()
                .filter(|(_, read, _)| *read)
                .map(|(url, _, _)| url)
                .collect();
            defaults.read.retain(|url| !own.contains(url));
            defaults.read.splice(0..0, own);
            let want = Want::Profiles {
                pubkeys: vec![active],
                contacts: true,
            };
            let id = self.session.want.unwrap_or_else(|| {
                self.next_want += 1;
                self.next_want
            });
            self.wants.insert(id, want);
            self.session.want = Some(id);
        } else if let Some(id) = self.session.want.take() {
            self.wants.remove(&id);
        }
        self.defaults = defaults;
        self.schedule_replan(30);
    }

    pub(super) fn save_session(&self) {
        if let Some(db) = &self.db {
            let _ = idb::kv_put(db, "session", &self.session.saved_json());
        }
    }

    pub(super) fn add_account(&mut self, pubkey: String, signer: Signer, secret: Option<String>) {
        if let (Some(secret), Some(db)) = (&secret, &self.db) {
            let _ = idb::kv_put(db, &format!("secret:{pubkey}"), secret);
        }
        if let Some(secret) = secret {
            self.session.secrets.insert(pubkey.clone(), secret);
        }
        self.session
            .accounts
            .retain(|account| account.pubkey != pubkey);
        self.session.accounts.push(Account {
            pubkey: pubkey.clone(),
            signer,
        });
        self.session.active = Some(pubkey);
        self.save_session();
        self.apply_session_relays();
    }
}

pub(super) fn local(secret: &str) -> Result<(String, Signer, Option<String>), String> {
    let pubkey = public_key_from_secret_hex(secret).map_err(|_| "Invalid secret key.")?;
    if !is_pubkey(&pubkey) {
        return Err("Invalid secret key.".into());
    }
    Ok((pubkey, Signer::Local, Some(secret.to_owned())))
}

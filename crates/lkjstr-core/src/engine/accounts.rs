//! At most 32 device accounts. Serialized secrets are only for private storage.
#[path = "accounts_authority.rs"]
mod authority;
#[path = "accounts_crypto.rs"]
mod crypto;
use lkjstr_protocol as p;
use serde::{Deserialize, Serialize};
#[path = "accounts_secret.rs"]
pub mod secret;
#[path = "accounts_vault.rs"]
mod vault;
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Accounts {
    #[serde(default)]
    pub seen: std::collections::BTreeMap<String, u64>,
    // At most 6000 equal-timestamp event ids per device account (32 accounts).
    #[serde(default)]
    pub notification_ties: std::collections::BTreeMap<String, std::collections::BTreeSet<String>>,
    pub entries: Vec<Account>,
    pub active: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Account {
    #[serde(skip)]
    authority: u64,
    pub pubkey: String,
    pub signer: String,
    #[serde(default)]
    pub relay_hints: Vec<String>,
    secret: Option<secret::SecretText>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    encrypted_key: Option<String>,
    #[serde(skip)]
    unlocked_key: Option<lkjstr_nips::keys::SecretKey>,
    #[serde(default)]
    remote: Option<p::remote::Remote>,
}
impl Accounts {
    pub fn add(&mut self, how: &str, key: Option<&str>) -> Result<(), &'static str> {
        let (pubkey, signer, secret) = match how {
            "create" => {
                let secret = p::generate_secret_key();
                (
                    p::public_key_from_secret(&secret).map_err(|_| "internal")?,
                    "local",
                    Some(p::bytes_to_hex(secret.as_bytes())),
                )
            }
            "extension" => {
                let key = key.filter(|s| p::is_pubkey(s)).ok_or("signer-missing")?;
                (key.to_owned(), "extension", None)
            }
            "key" => match key.and_then(p::decode_nip19) {
                Some(p::NostrEntity::Nsec(secret)) => (
                    p::public_key_from_secret_hex(&secret).map_err(|_| "rejected")?,
                    "local",
                    Some(secret),
                ),
                Some(p::NostrEntity::Npub(key)) => (key, "none", None),
                Some(p::NostrEntity::Nprofile(profile)) => (profile.pubkey, "none", None),
                _ => return Err("rejected"),
            },
            _ => return Err("unsupported"),
        };
        let relay_hints = match key.and_then(p::decode_nip19) {
            Some(p::NostrEntity::Nprofile(profile)) => profile
                .relays
                .into_iter()
                .flatten()
                .filter_map(|u| super::settings::strict_relay(&u))
                .take(8)
                .collect(),
            _ => vec![],
        };
        let secret = secret.map(secret::SecretText::new);
        if !self.entries.iter().any(|a| a.pubkey == pubkey) && self.entries.len() >= 32 {
            return Err("too-large");
        }
        if let Some(old) = self.entries.iter_mut().find(|a| a.pubkey == pubkey) {
            if signer != "none" {
                old.renew_authority()?;
                old.signer = signer.into();
                old.secret = secret;
                old.remote = None;
                old.encrypted_key = None;
                old.unlocked_key = None;
            }
            if !relay_hints.is_empty() {
                old.relay_hints = relay_hints;
            }
        } else {
            self.entries.push(Account {
                authority: 0,
                pubkey: pubkey.clone(),
                signer: signer.into(),
                secret,
                relay_hints,
                remote: None,
                encrypted_key: None,
                unlocked_key: None,
            });
        }
        self.active = Some(pubkey);
        Ok(())
    }
    /// Only the explicit account.key request may call this export.
    pub fn backup_key(&self, pubkey: &str) -> Result<String, &'static str> {
        let a = self
            .entries
            .iter()
            .find(|a| a.pubkey == pubkey)
            .ok_or("not-found")?;
        if a.signer != "local" {
            return Err("unsupported");
        }
        let key = a.local_key()?;
        let hex = zeroize::Zeroizing::new(lkjstr_nips::hex(key.as_bytes()));
        lkjstr_protocol::encode_nsec(&hex).map_err(|_| "internal")
    }
    pub fn private_entries(&self, event: &p::NostrEvent) -> Option<Vec<Vec<String>>> {
        let a = self.entries.iter().find(|a| a.pubkey == event.pubkey)?;
        let owner = a.local_key().ok()?;
        let event = serde_json::from_str(&serde_json::to_string(event).ok()?).ok()?;
        lkjstr_nips::list_crypto::decrypt(&event, &owner).ok()
    }
    pub fn remote(&self, pubkey: &str) -> Option<p::remote::Remote> {
        self.entries
            .iter()
            .find(|a| a.pubkey == pubkey)?
            .remote
            .clone()
    }
    pub fn add_remote(
        &mut self,
        pubkey: String,
        session: p::remote::Remote,
    ) -> Result<(), &'static str> {
        if !p::is_pubkey(&pubkey) {
            return Err("rejected");
        }
        if self.entries.len() >= 32 && !self.entries.iter().any(|a| a.pubkey == pubkey) {
            return Err("too-large");
        }
        let authority = self
            .entries
            .iter()
            .find(|a| a.pubkey == pubkey)
            .map_or(Ok(0), |a| a.authority.checked_add(1).ok_or("internal"))?;
        self.entries.retain(|a| a.pubkey != pubkey);
        self.entries.push(Account {
            authority,
            pubkey: pubkey.clone(),
            signer: "remote".into(),
            secret: None,
            relay_hints: vec![],
            remote: Some(session),
            encrypted_key: None,
            unlocked_key: None,
        });
        self.active = Some(pubkey);
        Ok(())
    }
    pub fn use_account(&mut self, key: &str) -> Result<(), &'static str> {
        if !self.entries.iter().any(|a| a.pubkey == key) {
            return Err("not-found");
        }
        self.active = Some(key.into());
        Ok(())
    }
    pub fn remove(&mut self, key: &str) -> Result<(), &'static str> {
        if !self.entries.iter().any(|a| a.pubkey == key) {
            return Err("not-found");
        }
        self.seen.remove(key);
        self.notification_ties.remove(key);
        let prefix = format!("channel:{key}:");
        self.seen.retain(|k, _| !k.starts_with(&prefix));
        self.entries.retain(|a| a.pubkey != key);
        if self.active.as_deref() == Some(key) {
            self.active = self.entries.first().map(|a| a.pubkey.clone());
        }
        Ok(())
    }
    pub fn require_signer(&self, pubkey: &str) -> Result<(), &'static str> {
        let account = self
            .entries
            .iter()
            .find(|a| a.pubkey == pubkey)
            .ok_or("signed-out")?;
        match account.signer.as_str() {
            "none" => Err("read-only"),
            "local" if account.locked() => Err("signer-missing"),
            "local" | "extension" | "remote" => Ok(()),
            _ => Err("unsupported"),
        }
    }
    pub fn sign(
        &self,
        event: &p::UnsignedNostrEvent,
    ) -> Result<Option<p::NostrEvent>, &'static str> {
        let account = self
            .entries
            .iter()
            .find(|a| a.pubkey == event.pubkey)
            .ok_or("signed-out")?;
        match account.signer.as_str() {
            "local" => {
                let key = account.local_key()?;
                let id = p::compute_event_id(event).map_err(|_| "internal")?;
                let hash = lkjstr_nips::unhex::<32>(&id).map_err(|_| "internal")?;
                let sig = key.sign(&hash, &[0; 32]).map_err(|_| "internal")?;
                Ok(Some(p::NostrEvent {
                    id,
                    sig: lkjstr_nips::hex(&sig),
                    pubkey: event.pubkey.clone(),
                    created_at: event.created_at,
                    kind: event.kind,
                    tags: event.tags.clone(),
                    content: event.content.clone(),
                }))
            }
            "extension" => Ok(None),
            "none" => Err("read-only"),
            _ => Err("unsupported"),
        }
    }
}

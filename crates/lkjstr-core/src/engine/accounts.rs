//! At most 32 device accounts. Serialized secrets are only for private storage.
use lkjstr_protocol as p;
use serde::{Deserialize, Serialize};
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Accounts {
    #[serde(default)]
    pub seen: std::collections::BTreeMap<String, u64>,
    pub entries: Vec<Account>,
    pub active: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Account {
    pub pubkey: String,
    pub signer: String,
    secret: Option<String>,
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
                _ => return Err("rejected"),
            },
            _ => return Err("unsupported"),
        };
        if !self.entries.iter().any(|a| a.pubkey == pubkey) && self.entries.len() >= 32 {
            return Err("too-large");
        }
        if let Some(old) = self.entries.iter_mut().find(|a| a.pubkey == pubkey) {
            if signer != "none" {
                old.signer = signer.into();
                old.secret = secret;
            }
        } else {
            self.entries.push(Account {
                pubkey: pubkey.clone(),
                signer: signer.into(),
                secret,
                remote: None,
            });
        }
        self.active = Some(pubkey);
        Ok(())
    }
    pub fn private_entries(&self, event: &p::NostrEvent) -> Option<Vec<Vec<String>>> {
        let a = self.entries.iter().find(|a| a.pubkey == event.pubkey)?;
        let secret = p::parse_secret_key_hex(a.secret.as_deref()?)?;
        let owner = lkjstr_nips::keys::SecretKey::from_bytes(*secret.as_bytes()).ok()?;
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
        self.entries.retain(|a| a.pubkey != pubkey);
        self.entries.push(Account {
            pubkey: pubkey.clone(),
            signer: "remote".into(),
            secret: None,
            remote: Some(session),
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
        self.entries.retain(|a| a.pubkey != key);
        if self.active.as_deref() == Some(key) {
            self.active = self.entries.first().map(|a| a.pubkey.clone());
        }
        Ok(())
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
                p::sign_event_with_secret_hex(event, account.secret.as_deref().ok_or("internal")?)
                    .map(Some)
                    .map_err(|_| "internal")
            }
            "extension" => Ok(None),
            "none" => Err("read-only"),
            _ => Err("unsupported"),
        }
    }
}

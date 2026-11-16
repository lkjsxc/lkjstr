//! Password-controlled imports remain ciphertext in durable account storage.
use super::{Account, Accounts};
use lkjstr_nips::{keys::SecretKey, nip49};
impl Account {
    pub fn encrypted(&self) -> bool {
        self.encrypted_key.is_some()
    }
    pub fn locked(&self) -> bool {
        self.encrypted() && self.unlocked_key.is_none()
    }
    pub(super) fn local_key(&self) -> Result<SecretKey, &'static str> {
        if self.signer != "local" {
            return Err("unsupported");
        }
        let key = if self.encrypted() {
            self.unlocked_key.clone().ok_or("signer-missing")?
        } else {
            let bytes = lkjstr_nips::unhex::<32>(self.secret.as_deref().ok_or("internal")?)
                .map_err(|_| "internal")?;
            SecretKey::from_bytes(bytes).map_err(|_| "internal")?
        };
        if key.public_key() != self.pubkey {
            return Err("rejected");
        }
        Ok(key)
    }
}
impl Accounts {
    /// Only a caller holding the password can import or replace an encrypted key.
    /// The host commits this cloned state transactionally before exposing success.
    pub fn import_encrypted(&mut self, encoded: &str, password: &str) -> Result<(), &'static str> {
        let encrypted = nip49::EncryptedKey::parse(encoded).map_err(code)?;
        let key = encrypted.decrypt(password).map_err(code)?;
        let pubkey = key.public_key();
        if self.entries.len() >= 32 && !self.entries.iter().any(|a| a.pubkey == pubkey) {
            return Err("too-large");
        }
        let encoded = encrypted.encode().map_err(code)?;
        if let Some(account) = self.entries.iter_mut().find(|a| a.pubkey == pubkey) {
            account.renew_authority()?;
            account.signer = "local".into();
            account.secret = None;
            account.remote = None;
            account.encrypted_key = Some(encoded);
            account.unlocked_key = Some(key);
        } else {
            self.entries.push(Account {
                authority: 0,
                pubkey: pubkey.clone(),
                signer: "local".into(),
                relay_hints: vec![],
                secret: None,
                remote: None,
                encrypted_key: Some(encoded),
                unlocked_key: Some(key),
            });
        }
        self.active = Some(pubkey);
        Ok(())
    }
    /// Unlock only for this Worker lifetime; the session key is serde-skipped.
    pub fn unlock(&mut self, pubkey: &str, password: &str) -> Result<(), &'static str> {
        let account = self
            .entries
            .iter_mut()
            .find(|a| a.pubkey == pubkey)
            .ok_or("not-found")?;
        let encoded = account.encrypted_key.as_deref().ok_or("unsupported")?;
        let key = nip49::EncryptedKey::parse(encoded)
            .map_err(code)?
            .decrypt(password)
            .map_err(code)?;
        if account.signer != "local" || key.public_key() != account.pubkey {
            return Err("rejected");
        }
        account.unlocked_key = Some(key);
        Ok(())
    }
    /// Erase the session key. Legacy plaintext accounts are not falsely called locked.
    pub fn lock(&mut self, pubkey: &str) -> Result<(), &'static str> {
        let account = self
            .entries
            .iter_mut()
            .find(|a| a.pubkey == pubkey)
            .ok_or("not-found")?;
        if !account.encrypted() {
            return Err("unsupported");
        }
        account.unlocked_key = None;
        Ok(())
    }
    /// Explicit encrypted backup. Never rewrites storage or downgrades protection.
    pub fn export_encrypted(
        &self,
        pubkey: &str,
        password: &str,
        log_n: u8,
        salt: &[u8; 16],
        nonce: &[u8; 24],
    ) -> Result<String, &'static str> {
        if password.is_empty() || log_n < nip49::DEFAULT_LOG_N {
            return Err("rejected");
        }
        if log_n > nip49::MAX_LOG_N {
            return Err("too-large");
        }
        let account = self
            .entries
            .iter()
            .find(|a| a.pubkey == pubkey)
            .ok_or("not-found")?;
        let key = account.local_key()?;
        // Legacy keys are known to have been stored in plaintext. For imported
        // vaults, preserve known exposure; otherwise use unknown because explicit
        // raw backup history is not tracked.
        let security = account
            .encrypted_key
            .as_deref()
            .and_then(|v| nip49::EncryptedKey::parse(v).ok())
            .map_or(0, |v| if v.security() == 0 { 0 } else { 2 });
        nip49::encrypt(&key, password, log_n, security, salt, nonce)
            .and_then(|v| v.encode())
            .map_err(code)
    }
}
fn code(error: lkjstr_nips::Error) -> &'static str {
    if error == lkjstr_nips::Error::Size {
        "too-large"
    } else {
        "rejected"
    }
}

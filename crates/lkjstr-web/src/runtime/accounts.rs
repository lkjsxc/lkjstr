//! Account commands for the UI: create, import, extension, switch, remove,
//! back up, and signing with whichever signer the active account uses.

use leptos::prelude::Update;
use lkjstr_protocol::{
    EventTemplate, NostrEntity, NostrEvent, UnsignedNostrEvent, bytes_to_hex, decode_nip19,
    encode_nsec, finalize_event, generate_secret_key, parse_secret_key_hex,
};

use super::session::{Signer, local};
use super::{App, Session};
use crate::host::{idb, nip07};

impl App {
    fn session_changed(&self) {
        self.session_rev.update(|rev| *rev += 1);
        self.rev.update(|rev| *rev += 1);
    }

    /// Creates a fresh local key on this device.
    pub async fn generate_account(&self) -> Result<String, String> {
        let (pubkey, signer, secret) = local(&bytes_to_hex(generate_secret_key().as_bytes()))?;
        self.add_account(pubkey.clone(), signer, secret).await?;
        Ok(pubkey)
    }

    /// Accepts nsec/hex secret (local signer) or npub/hex pubkey (read-only).
    pub async fn import_account(&self, input: &str) -> Result<String, String> {
        let input = input.trim();
        let (pubkey, signer, secret) = match decode_nip19(input) {
            Some(NostrEntity::Nsec(secret)) => local(&secret)?,
            Some(NostrEntity::Npub(pubkey)) => (pubkey, Signer::ReadOnly, None),
            Some(NostrEntity::Nprofile(pointer)) => (pointer.pubkey, Signer::ReadOnly, None),
            _ if parse_secret_key_hex(input).is_some() && input.len() == 64 => {
                return Err(
                    "Ambiguous 64-character hex: paste an nsec1… or npub1… instead.".into(),
                );
            }
            _ => return Err("Paste an nsec1… secret key or an npub1… public key.".into()),
        };
        self.add_account(pubkey.clone(), signer, secret).await?;
        Ok(pubkey)
    }

    pub async fn connect_extension(&self) -> Result<String, String> {
        let pubkey = nip07::public_key().await?;
        self.add_account(pubkey.clone(), Signer::Extension, None)
            .await?;
        Ok(pubkey)
    }

    async fn commit_session(
        &self,
        edit: impl FnOnce(&mut Session) -> Vec<(String, Option<String>)>,
    ) -> Result<(), String> {
        let (db, mut candidate) = self.update(|rt| {
            if rt.session_busy {
                return Err("An account change is already saving.");
            }
            let db = rt
                .db
                .clone()
                .ok_or("Account storage unavailable. No account was changed.")?;
            rt.session_busy = true;
            Ok((db, rt.session.clone()))
        })?;
        let mut rows = edit(&mut candidate);
        rows.push(("session".into(), Some(candidate.saved_json())));
        let result = idb::kv_commit(&db, &rows).await;
        self.update(|rt| {
            rt.session_busy = false;
            if result.is_ok() {
                rt.session = candidate;
                rt.apply_session_relays();
            }
        });
        self.session_changed();
        result.map_err(|_| "Account storage write failed. No account was changed.".into())
    }

    async fn add_account(
        &self,
        pubkey: String,
        signer: Signer,
        secret: Option<String>,
    ) -> Result<(), String> {
        self.commit_session(move |session| {
            let rows = secret
                .as_ref()
                .map(|value| (format!("secret:{pubkey}"), Some(value.clone())))
                .into_iter()
                .collect();
            session.add_account(pubkey, signer, secret);
            rows
        })
        .await
    }

    pub async fn switch_account(&self, pubkey: &str) -> Result<(), String> {
        self.commit_session(|session| {
            session.active = Some(pubkey.to_owned());
            Vec::new()
        })
        .await
    }

    pub async fn remove_account(&self, pubkey: &str) -> Result<(), String> {
        self.commit_session(|session| {
            session.accounts.retain(|a| a.pubkey != pubkey);
            session.secrets.remove(pubkey);
            if session.active.as_deref() == Some(pubkey) {
                session.active = session.accounts.first().map(|a| a.pubkey.clone());
            }
            vec![(format!("secret:{pubkey}"), None)]
        })
        .await
    }

    /// Explicit user action only: the nsec of a local account, for backup.
    pub fn reveal_nsec(&self, pubkey: &str) -> Option<String> {
        self.with(|rt| {
            rt.session
                .secrets
                .get(pubkey)
                .and_then(|s| encode_nsec(s).ok())
        })
    }

    pub async fn sign(&self, unsigned: UnsignedNostrEvent) -> Result<NostrEvent, String> {
        let (signer, secret) = self.with(|rt| {
            let signer = rt.session.active_account().map(|a| a.signer);
            (signer, rt.session.local_secret().map(str::to_owned))
        });
        match (signer, secret) {
            (Some(Signer::Local), Some(secret)) => {
                let key = parse_secret_key_hex(&secret).ok_or("Stored key is invalid.")?;
                let template = EventTemplate {
                    pubkey: Some(unsigned.pubkey),
                    created_at: unsigned.created_at,
                    kind: unsigned.kind,
                    tags: unsigned.tags,
                    content: unsigned.content,
                };
                finalize_event(&template, &key).map_err(|_| "Signing failed.".to_owned())
            }
            (Some(Signer::Extension), _) => nip07::sign(&unsigned).await,
            _ => Err("This account cannot sign. Add a key or a signer extension.".to_owned()),
        }
    }
}

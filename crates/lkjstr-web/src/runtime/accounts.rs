//! Account commands for the UI: create, import, extension, switch, remove,
//! back up, and signing with whichever signer the active account uses.

use leptos::prelude::Update;
use lkjstr_protocol::{
    EventTemplate, NostrEntity, NostrEvent, UnsignedNostrEvent, bytes_to_hex, decode_nip19,
    encode_nsec, finalize_event, generate_secret_key, parse_secret_key_hex,
};

use super::App;
use super::session::{Signer, local};
use crate::host::{idb, nip07};

impl App {
    fn session_changed(&self) {
        self.session_rev.update(|rev| *rev += 1);
        self.rev.update(|rev| *rev += 1);
    }

    /// Creates a fresh local key on this device.
    pub fn generate_account(&self) -> Result<String, String> {
        let (pubkey, signer, secret) = local(&bytes_to_hex(generate_secret_key().as_bytes()))?;
        self.update(|rt| rt.add_account(pubkey.clone(), signer, secret));
        self.session_changed();
        Ok(pubkey)
    }

    /// Accepts nsec/hex secret (local signer) or npub/hex pubkey (read-only).
    pub fn import_account(&self, input: &str) -> Result<String, String> {
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
        self.update(|rt| rt.add_account(pubkey.clone(), signer, secret));
        self.session_changed();
        Ok(pubkey)
    }

    pub async fn connect_extension(&self) -> Result<String, String> {
        let pubkey = nip07::public_key().await?;
        self.update(|rt| rt.add_account(pubkey.clone(), Signer::Extension, None));
        self.session_changed();
        Ok(pubkey)
    }

    pub fn switch_account(&self, pubkey: &str) {
        self.update(|rt| {
            rt.session.active = Some(pubkey.to_owned());
            rt.save_session();
            rt.apply_session_relays();
        });
        self.session_changed();
    }

    pub fn remove_account(&self, pubkey: &str) {
        self.update(|rt| {
            rt.session.accounts.retain(|a| a.pubkey != pubkey);
            rt.session.secrets.remove(pubkey);
            if let Some(db) = &rt.db {
                let _ = idb::kv_delete(db, &format!("secret:{pubkey}"));
            }
            if rt.session.active.as_deref() == Some(pubkey) {
                rt.session.active = rt.session.accounts.first().map(|a| a.pubkey.clone());
            }
            rt.save_session();
            rt.apply_session_relays();
        });
        self.session_changed();
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

//! Bounded private drafts and failed sends; never evict unsaved content.
#[path = "drafts_codec.rs"]
mod codec;
#[path = "drafts_seed.rs"]
mod seed;
#[path = "drafts_state.rs"]
mod state;
#[path = "drafts_store.rs"]
mod store;
use crate::engine::accounts::secret::SecretText;
pub use codec::{Envelope, open, seal};
pub use seed::{PreparedSeed, open_seed, prepare_seed};
use serde::{Deserialize, Serialize};
pub use state::{Delivery, Failed, Failure, State};
use std::collections::BTreeMap;
pub use store::{compare, removal_rows, saved_account};

pub const MAX_TABS: usize = 32;
pub const MAX_FAILED: usize = 32;
pub const MAX_STATE: usize = 256 * 1024;
pub const MAX_CATALOG: usize = 2 * 1024 * 1024;
pub const GENERATION_KEY: &str = "dm-drafts-generation-v1";
pub const PURPOSE: &str = "lkjstr-private-drafts";
#[derive(Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    tabs: BTreeMap<String, State>,
}
impl Catalog {
    pub fn from_json(raw: &str) -> Result<Self, &'static str> {
        if raw.len() > MAX_CATALOG {
            return Err("too-large");
        }
        let value: Self = serde_json::from_str(raw).map_err(|_| "rejected")?;
        if value.tabs.len() > MAX_TABS {
            return Err("too-large");
        }
        for (tab, state) in &value.tabs {
            tab_key(tab)?;
            state::validate(state)?;
        }
        Ok(value)
    }
    pub fn encoded(&self) -> Result<SecretText, &'static str> {
        let raw = SecretText::new(serde_json::to_string(self).map_err(|_| "internal")?);
        if raw.len() > MAX_CATALOG {
            return Err("too-large");
        }
        Ok(raw)
    }
    pub fn revision(&self, account: &str, tab: &str, nonce: &str) -> Result<String, &'static str> {
        storage_key(account)?;
        tab_key(tab)?;
        if !generation(nonce) {
            return Err("rejected");
        }
        let scope = serde_json::to_string(&(PURPOSE, account, tab, nonce, self.stamp(tab)?))
            .map_err(|_| "internal")?;
        Ok(lkjstr_protocol::upload::hash(scope.as_bytes()))
    }
    pub fn check_revision(
        &self,
        account: &str,
        tab: &str,
        nonce: &str,
        expected: Option<&str>,
    ) -> Result<String, &'static str> {
        let revision = self.revision(account, tab, nonce)?;
        if expected.is_some_and(|expected| expected != revision) {
            return Err("rejected");
        }
        Ok(revision)
    }
    pub fn get(&self, tab: &str) -> Option<&State> {
        self.tabs.get(tab)
    }
    pub fn stamp(&self, tab: &str) -> Result<Option<String>, &'static str> {
        self.tabs.get(tab).map(stamp).transpose()
    }
    /// A CAS retry may merge other tabs, but never overwrite a changed same-tab state.
    pub fn apply(
        &mut self,
        tab: &str,
        next: Option<State>,
        expected: Option<&str>,
    ) -> Result<bool, &'static str> {
        tab_key(tab)?;
        if let Some(next) = &next {
            state::validate(next)?;
        }
        let current = self.stamp(tab)?;
        let wanted = next.as_ref().map(stamp).transpose()?;
        if current == wanted {
            return Ok(false);
        }
        if current.as_deref() != expected {
            return Err("rejected");
        }
        if next.is_some() && !self.tabs.contains_key(tab) && self.tabs.len() >= MAX_TABS {
            return Err("too-large");
        }
        let previous = self.tabs.remove(tab);
        if let Some(next) = next {
            self.tabs.insert(tab.into(), next);
        }
        if let Err(code) = self.encoded() {
            self.tabs.remove(tab);
            if let Some(previous) = previous {
                self.tabs.insert(tab.into(), previous);
            }
            return Err(code);
        }
        Ok(true)
    }
}
pub fn validate(state: &State) -> Result<(), &'static str> {
    state::validate(state)
}
pub fn tab_key(tab: &str) -> Result<(), &'static str> {
    if tab.is_empty() || tab.len() > 256 || tab.chars().any(char::is_control) {
        Err("rejected")
    } else {
        Ok(())
    }
}
pub fn storage_key(account: &str) -> Result<String, &'static str> {
    if !lkjstr_protocol::is_pubkey(account) {
        return Err("rejected");
    }
    Ok(format!("dm-drafts-v1:{account}"))
}
pub fn generation(value: &str) -> bool {
    value.len() == 32
        && value
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
fn stamp(state: &State) -> Result<String, &'static str> {
    let raw = SecretText::new(serde_json::to_string(state).map_err(|_| "internal")?);
    Ok(lkjstr_protocol::upload::hash(raw.as_bytes()))
}
impl std::fmt::Debug for Catalog {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DmDraftCatalog [redacted]")
    }
}

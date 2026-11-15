//! Only verified HTTP evidence can promote a claimed identifier.
use super::Store;
use lkjstr_nips::identity::{HttpResponse, Identifier, verify_response};
impl Store {
    pub fn nip05_verified(&self, pubkey: &str) -> bool {
        self.verified_nip05
            .get(pubkey)
            .is_some_and(|name| self.profile(pubkey).is_some_and(|p| p.nip05 == *name))
    }
    pub fn verify_nip05(&mut self, pubkey: &str, claimed: &str, response: HttpResponse) -> bool {
        if self.profile(pubkey).is_none_or(|p| p.nip05 != claimed) {
            return false;
        }
        let Ok(identifier) = Identifier::parse(claimed) else {
            return false;
        };
        if verify_response(&identifier, pubkey, response, 65536).is_err() {
            return false;
        }
        self.verified_nip05.insert(pubkey.into(), claimed.into());
        self.revision += 1;
        self.snapshot_revision = self.revision;
        true
    }
}

impl super::Store {
    pub fn query_name(&self, name: &str) -> Option<String> {
        self.query_names.get(name).cloned()
    }
    pub fn resolve_query_name(
        &mut self,
        name: &str,
        response: lkjstr_nips::identity::HttpResponse,
    ) -> bool {
        let Ok(id) = lkjstr_nips::identity::Identifier::parse(name) else {
            return false;
        };
        let key = serde_json::from_str::<serde_json::Value>(&response.body)
            .ok()
            .and_then(|v| v["names"][&id.name].as_str().map(str::to_owned));
        let Some(key) = key else {
            return false;
        };
        if lkjstr_nips::identity::verify_response(&id, &key, response, 65536).is_err() {
            return false;
        }
        if self.query_names.len() >= 512 && !self.query_names.contains_key(name) {
            self.query_names.clear();
        }
        self.query_names.insert(name.into(), key);
        self.revision = self.revision.wrapping_add(1);
        self.snapshot_revision = self.revision;
        true
    }
}

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
        true
    }
}

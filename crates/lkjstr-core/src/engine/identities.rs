use super::Engine;
impl Engine {
    /// Only identities of visible rows are fetched, at most 120 per pass.
    pub fn identity_wants(&self) -> Vec<(String, String)> {
        let mut wanted = std::collections::BTreeSet::new();
        for v in self.views.values().filter(|v| v.visible) {
            for r in v.rows.iter().take(60) {
                if !r.author.nip05_verified
                    && let Some(name) = &r.author.nip05
                {
                    wanted.insert((r.author.pubkey.clone(), name.clone()));
                }
                if wanted.len() >= 120 {
                    break;
                }
            }
        }
        wanted.into_iter().take(120).collect()
    }
    pub fn identity_result(
        &mut self,
        pubkey: &str,
        name: &str,
        response: lkjstr_nips::identity::HttpResponse,
    ) {
        if self.store.verify_nip05(pubkey, name, response) {
            for v in self.views.values_mut() {
                v.dirty = true;
            }
        }
    }
}

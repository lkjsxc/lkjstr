//! Text scans filter compact content before materializing selected rows.
use super::{Event, Store};
use crate::kinds::policy;

impl Store {
    /// Case-insensitive text match over notes, newest first.
    pub fn search_notes(&self, needle: &str, limit: usize) -> Vec<Event> {
        let needle = needle.to_lowercase();
        if needle.trim().is_empty() {
            return Vec::new();
        }
        self.by_time
            .iter()
            .rev()
            .map(|key| &key.0)
            .filter(|event| {
                policy(event.kind).reply && event.content.to_lowercase().contains(&needle)
            })
            .take(limit)
            .map(|event| event.materialize())
            .collect()
    }

    /// People whose name, display name or NIP-05 contains `needle`.
    pub fn search_people(&self, needle: &str, limit: usize) -> Vec<String> {
        let needle = needle.to_lowercase();
        if needle.trim().is_empty() {
            return Vec::new();
        }
        let mut found: Vec<&String> = self
            .profiles
            .iter()
            .filter(|(_, profile)| {
                [&profile.name, &profile.display_name, &profile.nip05]
                    .iter()
                    .any(|field| field.to_lowercase().contains(&needle))
            })
            .map(|(pubkey, _)| pubkey)
            .collect();
        found.sort();
        found.into_iter().take(limit).cloned().collect()
    }
}

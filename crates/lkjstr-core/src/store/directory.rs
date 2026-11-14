//! The store answers the planner's outbox questions from stored kind 10002.

use super::Store;
use crate::plan::Directory;

impl Directory for Store {
    fn write_relays(&self, pubkey: &str) -> Option<Vec<String>> {
        let list = self.relay_list(pubkey)?;
        Some(
            list.into_iter()
                .filter(|(_, _, write)| *write)
                .map(|(url, _, _)| url)
                .collect(),
        )
    }

    fn read_relays(&self, pubkey: &str) -> Option<Vec<String>> {
        let list = self.relay_list(pubkey)?;
        Some(
            list.into_iter()
                .filter(|(_, read, _)| *read)
                .map(|(url, _, _)| url)
                .collect(),
        )
    }
}

use super::{Event, Store};
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::compare_events_desc;

impl Store {
    /// Best retained revision of an exact address, using NIP-01's lowest-ID tie break.
    pub(crate) fn addressed(&self, coordinate: &Coordinate) -> Option<Event> {
        self.by_author
            .get(&coordinate.pubkey)?
            .iter()
            .filter_map(|(_, id)| self.events.get(id))
            .filter(|event| {
                event.kind == u64::from(coordinate.kind)
                    && (coordinate.kind < 30000
                        || event
                            .tags
                            .iter()
                            .find(|tag| tag.first().is_some_and(|key| key == "d"))
                            .and_then(|tag| tag.get(1))
                            .map_or("", String::as_str)
                            == coordinate.identifier)
            })
            .min_by(|a, b| compare_events_desc(a, b))
            .cloned()
    }
}

impl Store {
    pub(super) fn replace_address(
        &mut self,
        event: &lkjstr_protocol::NostrEvent,
    ) -> Option<super::Inserted> {
        let identifier = super::weighted::identifier(event)?;
        let key = (event.pubkey.clone(), event.kind, identifier.to_owned());
        let old = self.addressable.get(&key).and_then(|id| self.get(id));
        if let Some(old) = &old {
            if compare_events_desc(old, event).is_lt() {
                return Some(super::Inserted::Stale);
            }
            self.remove(&old.id);
        }
        self.addressable.insert(key, event.id.clone());
        old.map(|_| super::Inserted::Replaced)
    }
}

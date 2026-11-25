use super::{Event, Store, decode_id};
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::compare_events_desc;

impl Store {
    /// Best retained revision of an exact address, using NIP-01's lowest-ID tie break.
    pub(crate) fn addressed(&self, coordinate: &Coordinate) -> Option<Event> {
        self.by_author
            .get(&decode_id(&coordinate.pubkey)?)?
            .iter()
            .map(|key| &key.0)
            .filter(|event| {
                event.kind == u64::from(coordinate.kind)
                    && (coordinate.kind < 30000
                        || event
                            .identifier()
                            .is_some_and(|d| d == coordinate.identifier))
            })
            .min_by(|a, b| b.order.0.cmp(&a.order.0).then_with(|| a.id().cmp(b.id())))
            .map(|event| event.materialize())
    }

    pub(super) fn replace_address(
        &mut self,
        event: &lkjstr_protocol::NostrEvent,
    ) -> Option<super::Inserted> {
        let identifier = super::weighted::identifier(event)?;
        let key = (decode_id(&event.pubkey)?, event.kind, identifier.to_owned());
        let old = self
            .addressable
            .get(&key)
            .and_then(|id| self.events.get(id))
            .map(|e| e.materialize());
        if let Some(old) = &old {
            if compare_events_desc(old, event).is_lt() {
                return Some(super::Inserted::Stale);
            }
            self.remove(&old.id);
        }
        self.addressable.insert(key, decode_id(&event.id)?);
        old.map(|_| super::Inserted::Replaced)
    }
}

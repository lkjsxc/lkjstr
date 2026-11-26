//! Verified revision and deletion authority precedes durable utility.
use super::*;
use lkjstr_nips::address::Coordinate;
impl Scan {
    pub fn new(state: State, access: Access, metadata: &[Record]) -> Self {
        let mut result = Self {
            used: Usage::default(),
            candidates: Candidates::default(),
            ranked: Candidates::default(),
            sealed: false,
            reweighted: false,
            scores: BTreeMap::new(),
            protected: access.held.clone(),
            required: BTreeSet::new(),
            deletions: BTreeSet::new(),
            addresses: BTreeMap::new(),
            versions: BTreeMap::new(),
            superseded: BTreeSet::new(),
            deleted: BTreeSet::new(),
            access,
            state,
        };
        for row in metadata {
            let Ok(Restored::Verified(event)) = row.restore() else {
                continue;
            };
            result.version(&event);
            if event.kind != 5 {
                continue;
            }
            result.protected.insert(event.id.clone());
            for tag in &event.tags {
                let [kind, target, ..] = tag.as_slice() else {
                    continue;
                };
                match kind.as_str() {
                    "e" if lkjstr_protocol::is_event_id(target) => {
                        result
                            .deletions
                            .insert((target.clone(), event.pubkey.clone()));
                    }
                    "a" => {
                        if let Ok(address) = Coordinate::parse(target)
                            && address.pubkey == event.pubkey
                        {
                            let at = result.addresses.entry(address.to_string()).or_default();
                            *at = (*at).max(event.created_at);
                        }
                    }
                    _ => {}
                }
            }
        }
        result
    }
    pub(super) fn version(&mut self, event: &lkjstr_protocol::NostrEvent) {
        if !retention::replaceable(event.kind) {
            return;
        }
        let identifier = if lkjstr_protocol::is_addressable_kind(event.kind) {
            lkjstr_protocol::tags::tag_values(event, "d")
                .into_iter()
                .next()
                .unwrap_or_default()
        } else {
            String::new()
        };
        let key = format!("{}:{}:{}", event.kind, event.pubkey, identifier);
        let own = self.access.own.contains(&event.pubkey) && retention::own_policy(event.kind);
        if let Some((at, id, _)) = self.versions.get(&key) {
            if *id == event.id {
                return;
            }
            if (*at, std::cmp::Reverse(id)) > (event.created_at, std::cmp::Reverse(&event.id)) {
                self.superseded.insert(event.id.clone());
                return;
            }
            self.superseded.insert(id.clone());
        }
        self.versions
            .insert(key, (event.created_at, event.id.clone(), own));
    }
}

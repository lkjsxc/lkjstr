use super::{Engine, channels};
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent};
use serde_json::{Value, json};
impl Engine {
    pub(crate) fn channel_tags(
        &self,
        id: &str,
        parent: Option<&NostrEvent>,
    ) -> Result<Vec<Vec<String>>, &'static str> {
        if !lkjstr_protocol::is_event_id(id) || self.store.get(id).is_some_and(|e| e.kind != 40) {
            return Err("rejected");
        }
        let relay = channels::relays(&self.store, id)
            .first()
            .cloned()
            .unwrap_or_default();
        let mut tags = vec![vec!["e".into(), id.into(), relay.clone(), "root".into()]];
        if let Some(p) = parent {
            if lkjstr_protocol::channel_id(p).as_deref() != Some(id) {
                return Err("rejected");
            }
            tags.push(vec![
                "e".into(),
                p.id.clone(),
                self.store.seen_on(&p.id).first().cloned().unwrap_or(relay),
                "reply".into(),
            ]);
            tags.push(vec!["p".into(), p.pubkey.clone()]);
        }
        Ok(tags)
    }
    pub(super) fn channel_save(
        &self,
        e: &mut UnsignedNostrEvent,
        id: Option<String>,
        mut channel: Value,
    ) -> Result<(), &'static str> {
        if !channel["name"]
            .as_str()
            .is_some_and(|s| !s.trim().is_empty())
            || channel.to_string().len() > 65536
        {
            return Err("rejected");
        }
        channel["relays"] = json!(
            self.network
                .relay_order
                .iter()
                .filter(|url| self.network.known.get(*url).is_some_and(|r| r.write))
                .take(8)
                .collect::<Vec<_>>()
        );
        if let Some(id) = id {
            let creation = self
                .store
                .get(&id)
                .filter(|e| e.kind == 40)
                .ok_or("rejected")?;
            if creation.pubkey != e.pubkey {
                return Err("rejected");
            }
            e.kind = 41;
            e.tags.push(vec![
                "e".into(),
                id.clone(),
                channels::relays(&self.store, &id)
                    .first()
                    .cloned()
                    .unwrap_or_default(),
                "root".into(),
            ]);
            let latest = self
                .store
                .referencing(&id)
                .iter()
                .filter(|v| v.kind == 41 && v.pubkey == e.pubkey)
                .map(|v| v.created_at)
                .max()
                .unwrap_or(0);
            e.created_at = e.created_at.max(latest.saturating_add(1));
        } else {
            if self.store.replaceable(&e.pubkey, 10005).is_none()
                && !self.network.list_loaded(&self.store, &e.pubkey, 10005)
            {
                return Err("list-not-loaded");
            }
            e.kind = 40;
        }
        e.content = channel.to_string();
        Ok(())
    }
}

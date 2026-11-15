use super::*;
impl Engine {
    pub(super) fn edit_list(
        &self,
        e: &mut UnsignedNostrEvent,
        key: &str,
        target: String,
        value: bool,
    ) -> Result<(), &'static str> {
        // Cache absence needs successful, untruncated relay lookups as evidence.
        let previous = self.store.replaceable(&e.pubkey, e.kind);
        if previous.is_none() && !self.network.list_loaded(&self.store, &e.pubkey, e.kind) {
            return Err("list-not-loaded");
        }
        if let Some(previous) = previous {
            if !value
                && !previous.content.is_empty()
                && !(previous.kind == 3
                    && serde_json::from_str::<serde_json::Value>(&previous.content)
                        .is_ok_and(|v| v.is_object()))
                && !previous
                    .tags
                    .iter()
                    .any(|t| t.first().is_some_and(|k| k == key) && t.get(1) == Some(&target))
            {
                return Err("private-list-edit-unsupported");
            }
            e.tags = previous.tags.clone();
            e.content = previous.content.clone();
            e.created_at = e.created_at.max(previous.created_at.saturating_add(1));
        }
        if e.kind == 10005
            && value
            && e.tags
                .iter()
                .any(|t| t.first().is_some_and(|k| k == key) && t.get(1) == Some(&target))
        {
            return Ok(());
        }
        e.tags
            .retain(|t| !(t.first().is_some_and(|s| s == key) && t.get(1) == Some(&target)));
        if value {
            e.tags.push(vec![key.into(), target]);
        }
        Ok(())
    }
    pub(in crate::engine) fn signed(&mut self, req: String, event: Option<NostrEvent>, now: u64) {
        let Some(pending) = self.signing.remove(&req) else {
            self.error(Some(req), "unknown-sign-request");
            return;
        };
        let Some(event) = event else {
            self.error(Some(req), "signer-rejected");
            return;
        };
        if crate::actions::validate_signed_event(&pending.event, &event).is_err() {
            self.error(Some(req), "invalid-signer-response");
            return;
        }
        if now >= pending.deadline {
            self.error(Some(req), "signer-timeout");
            return;
        }
        let routes = self.publication_routes(&event);
        if event.kind == 10002 {
            let entries = event
                .tags
                .iter()
                .filter(|t| t.first().is_some_and(|v| v == "r"))
                .filter_map(|t| {
                    Some(crate::engine::wire::RelayConfig {
                        url: t.get(1)?.clone(),
                        read: t.get(2).is_none_or(|v| v == "read"),
                        write: t.get(2).is_none_or(|v| v == "write"),
                        search: self.network.known.get(t.get(1)?).is_some_and(|r| r.search),
                    })
                })
                .collect();
            let _ = self.configure_relays(entries, now);
        }
        if event.kind == 5 {
            for id in lkjstr_protocol::tags::tag_values(&event, "e") {
                self.network.cancel_publication(&id);
            }
        }
        self.store.insert(event.clone(), None);
        self.pending.push(event.clone(), true);
        for v in self.views.values_mut() {
            v.dirty = true;
        }
        self.replan(now);
        if event.kind == 40 {
            self.start_channel_create(req, event, routes, now);
        } else {
            self.network.publish(req, event, routes, now);
        }
        self.replan(now);
    }
}

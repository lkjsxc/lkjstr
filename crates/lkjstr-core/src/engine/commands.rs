use super::{
    Engine, Signing,
    protocol::{Action, Delivery, Output},
};
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent, is_pubkey, normalize_relay_url};
impl Engine {
    pub(super) fn action(&mut self, req: String, account: String, action: Action, now: u64) {
        if !is_pubkey(&account) {
            self.error(Some(req), "invalid-account");
            return;
        }
        if self.signing.len() >= 64 || self.signing.contains_key(&req) {
            self.error(Some(req), "action-limit-or-duplicate");
            return;
        }
        match self.build(&account, action, now / 1000) {
            Ok(event) => {
                if matches!(event.kind, 3 | 10000 | 10003)
                    && self
                        .signing
                        .values()
                        .any(|s| s.event.pubkey == account && s.event.kind == event.kind)
                {
                    self.error(Some(req), "list-edit-pending");
                    return;
                }
                self.signing.insert(
                    req.clone(),
                    Signing {
                        event: event.clone(),
                        deadline: now + 60000,
                    },
                );
                self.outgoing.push(Output::Sign { req, event });
            }
            Err(code) => self.error(Some(req), code),
        }
    }
    fn build(
        &self,
        account: &str,
        action: Action,
        at: u64,
    ) -> Result<UnsignedNostrEvent, &'static str> {
        let mut e = UnsignedNostrEvent {
            pubkey: account.into(),
            created_at: at,
            kind: 1,
            tags: vec![],
            content: String::new(),
        };
        match action {
            Action::Publish {
                kind,
                content,
                target,
                tags,
            } => {
                if content.len() > 65536 || tags.len() > 1000 {
                    return Err("event-too-large");
                }
                e.content = content;
                e.tags = tags;
                if kind != "note" {
                    let parent = target
                        .as_deref()
                        .and_then(|id| self.store.get(id))
                        .ok_or("target-unavailable")?;
                    match kind.as_str() {
                        "reply" => e.tags.extend(lkjstr_protocol::reply_tags(&parent)),
                        "quote" => {
                            e.tags.push(vec!["q".into(), parent.id.clone()]);
                            e.tags.push(vec!["p".into(), parent.pubkey.clone()]);
                        }
                        "repost" => {
                            e.kind = 6;
                            e.tags.extend(lkjstr_protocol::repost_tags(&parent));
                            e.content =
                                serde_json::to_string(&*parent).map_err(|_| "serialization")?;
                        }
                        "reaction" => {
                            e.kind = 7;
                            e.tags.extend(lkjstr_protocol::reaction_tags(&parent, None));
                        }
                        "delete" => {
                            if parent.pubkey != account {
                                return Err("not-author");
                            }
                            e.kind = 5;
                            e.tags.push(vec!["e".into(), parent.id.clone()]);
                        }
                        _ => return Err("unsupported-publication"),
                    }
                }
            }
            Action::Follow { pubkey, value } => {
                if !is_pubkey(&pubkey) {
                    return Err("invalid-pubkey");
                }
                e.kind = 3;
                self.edit_list(&mut e, "p", pubkey, value)?;
            }
            Action::Mute {
                kind,
                target,
                value,
            } => {
                e.kind = 10000;
                let key = match kind.as_str() {
                    "person" => "p",
                    "word" => "word",
                    "hashtag" => "t",
                    "thread" => "e",
                    _ => return Err("invalid-mute"),
                };
                self.edit_list(&mut e, key, target, value)?;
            }
            Action::Bookmark { id, value } => {
                e.kind = 10003;
                self.edit_list(&mut e, "e", id, value)?;
            }
            Action::ProfileSave { content } => {
                if !serde_json::from_str::<serde_json::Value>(&content).is_ok_and(|v| v.is_object())
                {
                    return Err("invalid-profile");
                }
                e.kind = 0;
                e.content = content;
            }
            Action::RelaysSave { relays } => {
                e.kind = 10002;
                for r in relays {
                    let mut tag = vec![
                        "r".into(),
                        normalize_relay_url(&r.url).ok_or("invalid-relay")?,
                    ];
                    match (r.read, r.write) {
                        (true, true) => {}
                        (true, false) => tag.push("read".into()),
                        (false, true) => tag.push("write".into()),
                        (false, false) => return Err("unsupported"),
                    }
                    e.tags.push(tag);
                }
            }
            Action::Upload { .. } => return Err("upload-not-implemented"),
        }
        if e.kind == 1 {
            e.tags = lkjstr_protocol::content_derived_tags(&e.content, &[], &e.tags);
            if e.tags.len() > 1000 {
                return Err("event-too-large");
            }
        }
        Ok(e)
    }
    fn edit_list(
        &self,
        e: &mut UnsignedNostrEvent,
        key: &str,
        target: String,
        value: bool,
    ) -> Result<(), &'static str> {
        // Absence in a bounded cache is never proof of an empty remote list.
        let previous = self
            .store
            .replaceable(&e.pubkey, e.kind)
            .ok_or("list-not-loaded")?;
        e.tags = previous.tags.clone();
        e.content = previous.content.clone();
        e.created_at = e.created_at.max(previous.created_at.saturating_add(1));
        e.tags
            .retain(|t| !(t.first().is_some_and(|s| s == key) && t.get(1) == Some(&target)));
        if value {
            e.tags.push(vec![key.into(), target]);
        }
        Ok(())
    }
    pub(super) fn signed(&mut self, req: String, event: Option<NostrEvent>, now: u64) {
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
        self.store.insert(event.clone(), None);
        self.pending.push(event.clone(), true);
        for v in self.views.values_mut() {
            v.dirty = true;
        }
        self.replan(now);
        if self.network.relays.is_empty() {
            self.outgoing.push(Output::Result {
                req,
                id: Some(event.id),
                deliveries: Vec::<Delivery>::new(),
                error: Some("no-relays".into()),
            });
            return;
        }
        self.network.publish(req, event, now);
    }
}

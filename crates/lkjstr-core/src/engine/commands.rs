use super::{
    Engine, Signing,
    protocol::{Action, Output},
};
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent, is_pubkey};
impl Engine {
    pub(super) fn action(&mut self, req: String, account: String, action: Action, now: u64) {
        if !is_pubkey(&account) {
            self.error(Some(req), "invalid-account");
            return;
        }
        if self.signing.len() >= 64
            || self.signing.contains_key(&req)
            || self.channel_pending.contains_key(&req)
        {
            self.error(Some(req), "action-limit-or-duplicate");
            return;
        }
        if matches!(action, Action::ChannelSave { id: None, .. })
            && self.channel_creates.len()
                + self.signing.values().filter(|s| s.event.kind == 40).count()
                >= 64
        {
            self.error(Some(req), "too-large");
            return;
        }
        match self.build(&account, action.clone(), now / 1000) {
            Ok(event) => {
                if matches!(event.kind, 3 | 10000 | 10003 | 10005)
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
            Err("list-not-loaded")
                if matches!(
                    action,
                    Action::ChannelJoin { .. } | Action::ChannelSave { id: None, .. }
                ) =>
            {
                self.defer_channel_action(req, account, action, now);
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
                if kind == "channel" {
                    e.kind = 42;
                } else if kind == "long-form" {
                    e.kind = 30023;
                } else if kind != "note" {
                    let parent = target
                        .as_deref()
                        .and_then(|id| self.store.get(id))
                        .ok_or("target-unavailable")?;
                    match kind.as_str() {
                        "reply" => {
                            if let Some(id) = lkjstr_protocol::channel_id(&parent) {
                                e.kind = 42;
                                e.tags.extend(self.channel_tags(&id, Some(&parent))?);
                            } else {
                                e.tags.extend(lkjstr_protocol::reply_tags(&parent));
                            }
                        }
                        "quote" => {
                            e.tags.push(vec!["q".into(), parent.id.clone()]);
                            e.tags.push(vec!["p".into(), parent.pubkey.clone()]);
                        }
                        "repost" => {
                            e.kind = if parent.kind == 42 { 16 } else { 6 };
                            e.tags.extend(lkjstr_protocol::repost_tags(&parent));
                            if parent.kind == 42 {
                                e.tags.push(vec!["k".into(), "42".into()]);
                            }
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
            Action::ChannelJoin { id, on } => {
                if !lkjstr_protocol::is_event_id(&id)
                    || self.store.get(&id).is_some_and(|e| e.kind != 40)
                {
                    return Err("rejected");
                }
                e.kind = 10005;
                self.edit_list(&mut e, "e", id, on)?;
            }
            Action::ChannelSave { id, channel } => self.channel_save(&mut e, id, channel)?,
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
                if relays.len() > 64 {
                    return Err("invalid-relay");
                }
                e.kind = 10002;
                for r in relays {
                    let url = super::settings::strict_relay(&r.url).ok_or("invalid-relay")?;
                    if !r.read && !r.write {
                        continue;
                    }
                    let mut tag = vec!["r".into(), url];
                    match (r.read, r.write) {
                        (true, true) => {}
                        (true, false) => tag.push("read".into()),
                        (false, true) => tag.push("write".into()),
                        (false, false) => unreachable!(),
                    }
                    e.tags.push(tag);
                }
            }
            Action::ServersSave { servers } => {
                e.kind = 10063;
                for server in servers {
                    if !crate::engine::settings::valid_server(&server) {
                        return Err("invalid-server");
                    }
                    e.tags.push(vec!["server".into(), server]);
                }
            }
            Action::Upload { .. } => return Err("upload-not-implemented"),
        }
        if matches!(e.kind, 0 | 3 | 10000..=19999)
            && let Some(previous) = self.store.replaceable(account, e.kind)
        {
            e.created_at = e.created_at.max(previous.created_at.saturating_add(1));
        }
        if self.client_tag && matches!(e.kind, 1 | 6 | 7 | 16 | 40 | 41 | 42 | 30023) {
            e.tags.retain(|t| t.first().is_none_or(|k| k != "client"));
            e.tags.push(vec!["client".into(), "lkjstr".into()]);
        }
        if matches!(e.kind, 1 | 42 | 30023) {
            e.tags = lkjstr_protocol::content_derived_tags(&e.content, &[], &e.tags);
            if e.tags.len() > 1000 {
                return Err("event-too-large");
            }
        }
        Ok(e)
    }
}
#[path = "commands_finish.rs"]
mod finish;

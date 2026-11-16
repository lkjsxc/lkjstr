use super::actions::{Action as A, MuteTarget};
use super::*;
use crate::engine::{Engine, protocol as p};
impl Session {
    pub fn input(
        &mut self,
        input: Input,
        engine: &Engine,
    ) -> Result<Vec<p::Input>, (Option<String>, &'static str)> {
        Ok(match input {
            Input::Reading { sub, key } => self.reading(sub, key),
            Input::Preview { sub, ids } => {
                self.preview_near(sub, ids);
                vec![]
            }
            Input::StorageInspect { .. }
            | Input::StorageClose { .. }
            | Input::SignerAuthCancel { .. }
            | Input::ZapQuote { .. }
            | Input::ZapReceipts { .. }
            | Input::ZapClose { .. }
            | Input::DmFlushed { .. }
            | Input::DmOpen { .. }
            | Input::DmClose { .. }
            | Input::DmVisible { .. }
            | Input::DmMore { .. }
            | Input::Crypted { .. }
            | Input::UploadCancel { .. }
            | Input::Stats { .. }
            | Input::RowAtTime { .. }
            | Input::Relays { .. }
            | Input::Heartbeat
            | Input::Detach
            | Input::PublicKey { .. } => {
                vec![]
            }
            Input::Configure { config } => {
                let enabled = config.signed_out_global_filter.unwrap_or(true);
                self.config = config;
                vec![p::Input::GlobalPolicy { enabled }]
            }
            Input::Hint { hint } => {
                let watches = hint.delivery_watches.clone();
                self.preview_visible = hint.visible_subs.clone();
                self.preview_save_data = hint.save_data;
                self.preview_hidden = hint.page_hidden;
                self.timeline_visible = Some(if hint.page_hidden {
                    Default::default()
                } else {
                    hint.visible_subs.iter().cloned().collect()
                });
                let mut inputs = vec![p::Input::Hint {
                    visible_subs: hint.visible_subs,
                    focused_sub: hint.focused_sub,
                    page_hidden: hint.page_hidden,
                    idle: hint.idle,
                    save_data: hint.save_data,
                }];
                if let Some(reqs) = watches {
                    inputs.push(p::Input::DeliveryWatch {
                        reqs: reqs.into_iter().take(128).collect(),
                    });
                }
                inputs
            }
            Input::Open {
                sub,
                query,
                visible,
            } => {
                if self.queries.len() >= 128 && !self.queries.contains_key(&sub) {
                    return Err((None, "subscription-limit"));
                }
                let converted = query.convert().ok_or((None, "unsupported"))?;
                let visible = visible.unwrap_or(true) && !self.preview_hidden;
                let visible_subs = self
                    .timeline_visible
                    .get_or_insert_with(|| self.queries.keys().cloned().collect());
                if visible {
                    visible_subs.insert(sub.clone());
                } else {
                    visible_subs.remove(&sub);
                }
                self.timelines.remove(&sub);
                self.notification_states.remove(&sub);
                self.private_states.remove(&sub);
                self.searches.remove(&sub);
                self.queries.insert(sub.clone(), *query);
                vec![p::Input::OpenVisible {
                    sub,
                    query: converted,
                    visible,
                }]
            }
            Input::Close { sub } => {
                self.notification_states.remove(&sub);
                self.queries.remove(&sub);
                self.private_states.remove(&sub);
                self.searches.remove(&sub);
                self.delivered.remove(&sub);
                self.windows.remove(&sub);
                self.preview_near.remove(&sub);
                self.timelines.remove(&sub);
                self.return_keys.remove(&sub);
                vec![p::Input::Close { sub }]
            }
            Input::Window {
                sub,
                anchor,
                before,
                after,
                retain_above,
            } => {
                if !self.queries.contains_key(&sub) {
                    return Err((None, "unknown-subscription"));
                }
                let account = self.queries.get(&sub).and_then(|q| q.account.as_deref());
                let anchor = match anchor {
                    Anchor::Top(_) => None,
                    Anchor::Key { key } => {
                        self.search_header_anchor(&sub, &key).unwrap_or(Some(key))
                    }
                    Anchor::Month {
                        month,
                        offset,
                        return_key,
                    } => {
                        let return_key = return_key.and_then(|key| {
                            self.search_header_anchor(&sub, &key).unwrap_or(Some(key))
                        });
                        if let Some(key) =
                            return_key.filter(|key| engine.accepts_private_anchor(account, key))
                        {
                            self.return_keys.insert(sub.clone(), key);
                        }
                        Some(
                            self.timelines
                                .get(&sub)
                                .and_then(|i| i.key(month, offset))
                                .ok_or((None, "timeline-unavailable"))?,
                        )
                    }
                };
                let anchor = anchor.filter(|key| engine.accepts_private_anchor(account, key));
                let mut before = if retain_above { 6000 } else { before.min(800) };
                if self
                    .queries
                    .get(&sub)
                    .is_some_and(|q| q.source == "notifications" || q.notifications == Some(true))
                {
                    before = self.notification_before(&sub, engine, anchor.as_deref(), before);
                }
                self.windows
                    .insert(sub.clone(), (anchor.clone(), before, after.min(800)));
                vec![p::Input::Window {
                    sub,
                    anchor,
                    before,
                    after: after.saturating_sub(1),
                }]
            }
            Input::Signed { req, event, error } => vec![p::Input::Signed {
                req,
                event: event.and_then(|e| lkjstr_protocol::parse_nostr_event_json(&e, None).ok()),
                error,
            }],
            Input::Act { req, action } => {
                let (account, action) = match action {
                    A::Publish { account, what } => {
                        let action = super::publish::publish(what, engine, &account)
                            .map_err(|e| (Some(req.clone()), e))?;
                        (account, action)
                    }
                    A::Follow {
                        account,
                        pubkey,
                        on,
                    } => (account, p::Action::Follow { pubkey, value: on }),
                    A::Mute {
                        account,
                        target,
                        on,
                    } => {
                        let (kind, target) = match target {
                            MuteTarget::Person { pubkey } => ("person", pubkey),
                            MuteTarget::Word { word } => ("word", word),
                            MuteTarget::Hashtag { tag } => ("hashtag", tag),
                            MuteTarget::Thread { id } => ("thread", id),
                        };
                        (
                            account,
                            p::Action::Mute {
                                kind: kind.into(),
                                target,
                                value: on,
                            },
                        )
                    }
                    A::ChannelJoin { account, id, on } => {
                        (account, p::Action::ChannelJoin { id, on })
                    }
                    A::ChannelSave {
                        account,
                        id,
                        channel,
                    } => (account, p::Action::ChannelSave { id, channel }),
                    A::Bookmark { account, id, on } => {
                        (account, p::Action::Bookmark { id, value: on })
                    }
                    A::ProfileSave { account, profile } => (
                        account,
                        p::Action::ProfileSave {
                            content: profile.to_string(),
                        },
                    ),
                    A::RelaysSave { account, relays } => (
                        account,
                        p::Action::RelaysSave {
                            relays: relays
                                .into_iter()
                                .map(|r| p::RelayEntry {
                                    url: r.url,
                                    read: r.read,
                                    write: r.write,
                                })
                                .collect(),
                        },
                    ),
                    A::ServersSave { account, servers } => {
                        (account, p::Action::ServersSave { servers })
                    }
                    _ => return Err((Some(req), "unsupported")),
                };
                vec![p::Input::Action {
                    req,
                    account,
                    action,
                }]
            }
        })
    }
}

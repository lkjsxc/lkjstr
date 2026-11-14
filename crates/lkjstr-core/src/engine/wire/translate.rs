use super::actions::{Action as A, MuteTarget, Publish as P};
use super::*;
use crate::engine::{Engine, protocol as p};
impl Session {
    pub fn input(
        &mut self,
        input: Input,
        engine: &Engine,
    ) -> Result<Vec<p::Input>, (Option<String>, &'static str)> {
        Ok(match input {
            Input::Configure { config } => {
                self.config = config;
                vec![]
            }
            Input::Hint { hint } => vec![p::Input::Hint {
                visible_subs: hint.visible_subs,
                page_hidden: hint.page_hidden,
                idle: hint.idle,
                save_data: hint.save_data,
            }],
            Input::Open { sub, query } => {
                let converted = query.convert().ok_or((None, "unsupported"))?;
                self.queries.insert(sub.clone(), query);
                vec![p::Input::Open {
                    sub,
                    query: converted,
                }]
            }
            Input::Close { sub } => {
                self.queries.remove(&sub);
                self.delivered.remove(&sub);
                vec![p::Input::Close { sub }]
            }
            Input::Window {
                sub,
                anchor,
                before,
                after,
            } => {
                let anchor = match anchor {
                    Anchor::Top(_) => None,
                    Anchor::Key { key } => Some(key),
                };
                self.windows.insert(
                    sub.clone(),
                    (anchor.clone(), before.min(100), after.min(200)),
                );
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
                        let action =
                            publish(what, engine, &account).map_err(|e| (Some(req.clone()), e))?;
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
                            relays: relays.into_iter().map(|r| r.url).collect(),
                        },
                    ),
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
fn publish(what: P, engine: &Engine, account: &str) -> Result<p::Action, &'static str> {
    let (kind, content, target, tags) = match what {
        P::Note { draft } => {
            let mut text = draft.text;
            let mut tags = vec![];
            if let Some(cw) = draft.cw {
                tags.push(vec!["content-warning".into(), cw]);
            }
            for e in draft.emoji.unwrap_or_default() {
                if lkjstr_protocol::valid_custom_emoji_shortcode(&e.code)
                    && lkjstr_protocol::valid_custom_emoji_url(&e.url)
                {
                    tags.push(vec!["emoji".into(), e.code, e.url]);
                }
            }
            for m in draft.media.unwrap_or_default() {
                if !m.url.starts_with("https://") {
                    return Err("unsupported");
                }
                text.push_str(&format!("\n{}", m.url));
                let mut tag = vec![
                    "imeta".into(),
                    format!("url {}", m.url),
                    format!("m {}", m.mime),
                ];
                if let (Some(w), Some(h)) = (m.w, m.h) {
                    tag.push(format!("dim {w}x{h}"));
                }
                if let Some(alt) = m.alt {
                    tag.push(format!("alt {alt}"));
                }
                if let Some(hash) = m.sha256 {
                    tag.push(format!("x {hash}"));
                }
                tags.push(tag);
            }
            if let Some(id) = draft.quote {
                let parent = engine.store.get(&id).ok_or("not-found")?;
                tags.push(vec!["q".into(), id.clone()]);
                tags.push(vec!["p".into(), parent.pubkey.clone()]);
                text.push_str(&format!(
                    "\nnostr:{}",
                    lkjstr_protocol::encode_note(&id).map_err(|_| "not-found")?
                ));
            }
            (
                if draft.reply_to.is_some() {
                    "reply"
                } else {
                    "note"
                },
                text,
                draft.reply_to,
                tags,
            )
        }
        P::Repost { id } => ("repost", String::new(), Some(id), vec![]),
        P::Reaction { id, emoji, url } => {
            let tags = url
                .and_then(|u| {
                    lkjstr_protocol::parse_custom_emoji_input(&format!(
                        "{}:{u}",
                        emoji.trim_end_matches(':')
                    ))
                })
                .map(|e| vec![lkjstr_protocol::custom_emoji_tag_parts(&e)])
                .unwrap_or_default();
            ("reaction", emoji, Some(id), tags)
        }
        P::Delete { id, of, emoji } => {
            let id = if matches!(of.as_deref(), Some("reaction" | "repost")) {
                engine
                    .store
                    .referencing(&id)
                    .into_iter()
                    .find(|e| {
                        e.pubkey == account
                            && e.kind
                                == if of.as_deref() == Some("reaction") {
                                    7
                                } else {
                                    6
                                }
                            && emoji.as_ref().is_none_or(|v| *v == e.content)
                    })
                    .map(|e| e.id.clone())
                    .ok_or("not-found")?
            } else {
                id
            };
            ("delete", String::new(), Some(id), vec![])
        }
    };
    Ok(p::Action::Publish {
        kind: kind.into(),
        content,
        target,
        tags,
    })
}

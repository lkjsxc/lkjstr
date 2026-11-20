use super::actions::Publish as P;
use crate::engine::{Engine, protocol as p};
use lkjstr_protocol::{
    CustomEmoji, custom_emoji_reaction_shortcode, custom_emoji_tag_parts, emoji_tags,
};
pub(super) fn publish(what: P, engine: &Engine, account: &str) -> Result<p::Action, &'static str> {
    let (kind, content, target, tags) = match what {
        P::Note { draft } => {
            let mut text = super::mentions::expand(&draft.text, draft.mentions.unwrap_or_default());
            let mut tags = vec![];
            if let Some(form) = &draft.long_form {
                tags.push(vec!["d".into(), form.identifier.clone()]);
                if let Some(title) = &form.title {
                    tags.push(vec!["title".into(), title.clone()]);
                }
            }
            if let Some(cw) = draft.cw {
                tags.push(vec!["content-warning".into(), cw]);
            }
            let emoji = draft
                .emoji
                .unwrap_or_default()
                .into_iter()
                .filter_map(|e| CustomEmoji::from_parts(&e.code, &e.url, e.address.as_deref()))
                .collect::<Vec<_>>();
            tags.extend(emoji_tags(&text, &emoji));
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
            let channel = draft.channel.or_else(|| {
                draft
                    .reply_to
                    .as_deref()
                    .and_then(|id| engine.store.get(id))
                    .and_then(|e| lkjstr_protocol::channel_id(&e))
            });
            if let Some(id) = &channel {
                let parent = draft
                    .reply_to
                    .as_deref()
                    .and_then(|id| engine.store.get(id));
                if draft.reply_to.is_some() && parent.is_none() {
                    return Err("not-found");
                }
                tags.extend(engine.channel_tags(id, parent.as_deref())?);
            }
            (
                if channel.is_some() {
                    "channel"
                } else if draft.long_form.is_some() {
                    "long-form"
                } else if draft.reply_to.is_some() {
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
        P::Reaction {
            id,
            emoji,
            url,
            address,
        } => {
            let tags = url
                .as_deref()
                .and_then(|url| {
                    let code = custom_emoji_reaction_shortcode(&emoji)?;
                    CustomEmoji::from_parts(&code, url, address.as_deref())
                })
                .map(|e| vec![custom_emoji_tag_parts(&e)])
                .unwrap_or_default();
            ("reaction", emoji, Some(id), tags)
        }
        P::Delete { id, of, emoji } => {
            let mut ids = if matches!(of.as_deref(), Some("reaction" | "repost")) {
                engine
                    .store
                    .referencing(&id)
                    .into_iter()
                    .filter(|e| {
                        e.pubkey == account
                            && crate::engine::acts::target(e).as_deref() == Some(id.as_str())
                            && e.kind
                                == if of.as_deref() == Some("reaction") {
                                    7
                                } else if engine.store.get(&id).is_some_and(|e| e.kind == 42) {
                                    16
                                } else {
                                    6
                                }
                            && emoji.as_ref().is_none_or(|v| {
                                crate::reactions::label(v) == crate::reactions::label(&e.content)
                            })
                    })
                    .map(|e| e.id.clone())
                    .collect::<Vec<_>>()
            } else {
                vec![id]
            };
            ids.sort();
            ids.dedup();
            let first = ids.pop().ok_or("not-found")?;
            (
                "delete",
                String::new(),
                Some(first),
                ids.into_iter().map(|id| vec!["e".into(), id]).collect(),
            )
        }
    };
    Ok(p::Action::Publish {
        kind: kind.into(),
        content,
        target,
        tags,
    })
}

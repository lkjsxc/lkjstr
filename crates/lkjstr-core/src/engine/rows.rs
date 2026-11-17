//! Finished rows, with no browser effects. Verification claims require evidence.
pub use super::row_model::*;
use crate::{
    content::{self, Segment as Part},
    store::Store,
};
use lkjstr_protocol::{NostrEvent, content_warning_reason, custom_emojis, reply_parent};
use std::collections::BTreeMap;
pub fn author(store: &Store, pubkey: &str) -> Author {
    let p = store.profile(pubkey);
    Author {
        pubkey: pubkey.into(),
        profile_id: store.replaceable(pubkey, 0).map(|e| e.id.clone()),
        name: p.as_ref().and_then(|p| p.label()).unwrap_or(pubkey).into(),
        picture: p
            .as_ref()
            .map(|p| p.picture.clone())
            .filter(|s| !s.is_empty()),
        nip05: p
            .as_ref()
            .map(|p| p.nip05.clone())
            .filter(|s| !s.is_empty()),
        nip05_verified: store.nip05_verified(pubkey),
        name_segments: store
            .replaceable(pubkey, 0)
            .map(|e| {
                let emoji = custom_emojis(&e)
                    .into_iter()
                    .map(|e| (e.shortcode, e.url))
                    .collect::<Vec<_>>();
                let name = p.as_ref().and_then(|p| p.label()).unwrap_or(pubkey);
                crate::reading::name_parts(name, &emoji)
                    .into_iter()
                    .filter_map(|part| match part {
                        Part::Text(text) => Some(NameSegment::Text { text }),
                        Part::Emoji { code, url } => Some(NameSegment::Emoji { code, url }),
                        _ => None,
                    })
                    .collect()
            })
            .unwrap_or_else(|| {
                vec![NameSegment::Text {
                    text: pubkey.into(),
                }]
            }),
    }
}
pub fn row(store: &Store, event: &NostrEvent, account: Option<&str>, depth: usize) -> Row {
    row_with_lists(store, event, account, depth, &Default::default())
}
pub fn row_with_lists(
    store: &Store,
    event: &NostrEvent,
    account: Option<&str>,
    depth: usize,
    private: &super::settings::PrivateLists,
) -> Row {
    let emoji = custom_emojis(event)
        .into_iter()
        .map(|e| (e.shortcode, e.url))
        .collect::<Vec<_>>();
    let mut parts = if event.kind == 6 {
        Vec::new()
    } else {
        content::segments(&event.content, &emoji)
    };
    super::row_media::attachments(event, &mut parts);
    if event.kind == 6
        && let Some(id) = super::acts::target(event)
    {
        parts.push(Part::Quote { id, relays: vec![] });
    }
    for id in lkjstr_protocol::tags::tag_values(event, "q") {
        if !parts
            .iter()
            .any(|p| matches!(p, Part::Quote { id: i, .. } if *i == id))
        {
            parts.push(Part::Quote { id, relays: vec![] });
        }
    }
    let content = parts
        .into_iter()
        .take(4096)
        .map(|p| match p {
            Part::Text(text) => Segment::Text { text },
            Part::Link(url) => Segment::Link { url },
            Part::Hashtag(tag) => Segment::Hashtag { tag },
            Part::Mention(key) => Segment::Mention {
                author: author(store, &key),
            },
            Part::Emoji { code, url } => Segment::Emoji { code, url },
            Part::Quote { id, .. } => Segment::Quote {
                row: if depth < 2 {
                    store
                        .get(&id)
                        .map(|e| Box::new(row_with_lists(store, &e, account, depth + 1, private)))
                } else {
                    None
                },
                id,
            },
            Part::Image(url) => media(event, url, "image"),
            Part::Video(url) => media(event, url, "video"),
            Part::Audio(url) => media(event, url, "audio"),
        })
        .collect();
    let (_, repost_count, reaction_count) = store.counts(&event.id);
    let replies = super::thread::positions(store, &event.id)
        .into_iter()
        .filter(|(_, (role, _))| *role == "reply")
        .filter_map(|(id, _)| store.get(&id))
        .filter(|reply| {
            super::query::hidden_with_lists(
                store,
                &super::protocol::Query {
                    source: super::protocol::Source::Thread,
                    account: account.map(str::to_owned),
                    target: Some(event.id.clone()),
                    ..Default::default()
                },
                reply,
                private,
            )
            .is_none()
        })
        .count();
    let mut reactions: BTreeMap<(String, Option<String>), Reaction> = BTreeMap::new();
    for e in store.reactions(&event.id) {
        let url = custom_emojis(&e)
            .into_iter()
            .find(|v| e.content == format!(":{}:", v.shortcode))
            .map(|v| v.url);
        let content = crate::reactions::label(&e.content).to_owned();
        let r = reactions
            .entry((content.clone(), url.clone()))
            .or_insert(Reaction {
                content,
                url,
                count: 0,
                mine: false,
            });
        r.count += 1;
        r.mine |= account == Some(e.pubkey.as_str());
    }
    let mut reposts = store
        .referencing(&event.id)
        .into_iter()
        .filter(|e| {
            matches!(e.kind, 6 | 16) && super::acts::target(e).as_deref() == Some(&event.id)
        })
        .map(|e| author(store, &e.pubkey))
        .collect::<Vec<_>>();
    reposts.sort_by(|a, b| a.pubkey.cmp(&b.pubkey));
    reposts.dedup_by(|a, b| a.pubkey == b.pubkey);
    let own = Own {
        reposted: reposts.iter().any(|a| Some(a.pubkey.as_str()) == account),
        bookmarked: super::settings::list_has(store, private, account, 10003, "e", &event.id),
        muted: super::settings::list_has(store, private, account, 10000, "p", &event.pubkey),
    };
    Row {
        id: event.id.clone(),
        author: author(store, &event.pubkey),
        created_at: event.created_at,
        kind: event.kind,
        content,
        reply: reply_parent(event).map(|id| Context {
            author: store.get(&id).map(|e| author(store, &e.pubkey)),
            id,
        }),
        reposts,
        warning: content_warning_reason(event),
        counts: Counts {
            replies,
            reposts: repost_count,
            reactions: reaction_count,
            partial: false,
        },
        reactions: reactions.into_values().collect(),
        hidden_reason: own.muted.then(|| "muted-person".into()).or_else(|| {
            (event.kind == 1 && content::looks_like_noise(&event.content))
                .then(|| "machine-payload".into())
        }),
        own,
    }
}
pub fn list_has(store: &Store, account: Option<&str>, kind: u64, tag: &str, value: &str) -> bool {
    super::settings::list_has(store, &Default::default(), account, kind, tag, value)
}
fn media(event: &NostrEvent, url: String, kind: &str) -> Segment {
    let tag = event.tags.iter().find(|t| {
        t.first().is_some_and(|s| s == "imeta") && t.iter().any(|s| s == &format!("url {url}"))
    });
    let field = |key: &str| {
        tag.and_then(|t| t.iter().find_map(|s| s.strip_prefix(key)))
            .map(str::to_owned)
    };
    let dim = field("dim ").and_then(|s| {
        s.split_once('x')
            .map(|(a, b)| (a.parse::<u32>().ok(), b.parse::<u32>().ok()))
    });
    Segment::Media {
        url,
        kind: kind.into(),
        width: dim.and_then(|d| d.0),
        height: dim.and_then(|d| d.1),
        alt: field("alt "),
    }
}

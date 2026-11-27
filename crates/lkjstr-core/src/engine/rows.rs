//! Finished rows, with no browser effects. Verification claims require evidence.
pub use super::row_model::*;
use crate::{
    content::{self, Segment as Part},
    store::Store,
};
use lkjstr_protocol::{NostrEvent, content_warning_reason, custom_emojis, reply_parent};
pub(super) fn event_emoji(event: &NostrEvent) -> Vec<(String, String)> {
    custom_emojis(event)
        .into_iter()
        .map(|emoji| (emoji.shortcode, emoji.url))
        .collect()
}

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
                let name = p.as_ref().and_then(|p| p.label()).unwrap_or(pubkey);
                crate::reading::name_parts(name, &event_emoji(&e))
                    .into_iter()
                    .filter_map(|part| match part {
                        Part::Text(text) => Some(NameSegment::Text { text }),
                        Part::Emoji { code, url } => {
                            let (address, set) = super::emoji::details(store, &e, &code, &url);
                            Some(NameSegment::Emoji {
                                code,
                                url,
                                address,
                                set,
                            })
                        }
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
    row_with_query(
        store,
        event,
        &super::protocol::Query {
            account: account.map(str::to_owned),
            ..Default::default()
        },
        depth,
        private,
    )
}
pub(super) fn row_with_query(
    store: &Store,
    event: &NostrEvent,
    query: &super::protocol::Query,
    depth: usize,
    private: &super::settings::PrivateLists,
) -> Row {
    let account = query.account.as_deref();
    let repost = crate::kinds::policy(event.kind).act == Some(crate::kinds::ActKind::Repost);
    let mut parts = if repost {
        Vec::new()
    } else {
        content::segments(&event.content, &event_emoji(event))
    };
    super::row_media::attachments(event, &mut parts);
    if repost && let Some(id) = super::acts::target(event) {
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
            Part::Emoji { code, url } => {
                let (address, set) = super::emoji::details(store, event, &code, &url);
                Segment::Emoji {
                    code,
                    url,
                    address,
                    set,
                }
            }
            Part::Quote { id, .. } => Segment::Quote {
                row: if depth < 2 {
                    store
                        .get(&id)
                        .filter(|e| crate::kinds::policy(e.kind).openable)
                        .map(|e| {
                            let reason = super::visibility::reason(store, query, &e, private);
                            Box::new(match reason {
                                Some(reason) => super::visibility::covered_row(store, &e, reason),
                                None => row_with_query(store, &e, query, depth + 1, private),
                            })
                        })
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
    // Count evidence is account-scoped; target read policy cannot change its totals.
    let count_query = super::protocol::Query {
        source: super::protocol::Source::Thread,
        account: account.map(str::to_owned),
        target: Some(event.id.clone()),
        ..Default::default()
    };
    let replies = super::thread::positions(store, &event.id)
        .into_iter()
        .filter(|(_, (role, _))| *role == "reply")
        .filter_map(|(id, _)| store.get(&id))
        .filter(|reply| {
            super::query::hidden_with_lists(store, &count_query, reply, private).is_none()
        })
        .count();
    let reactions = super::emoji::reactions(store, &event.id, account);
    let mut own_repost = false;
    let mut reposted_at = None;
    let mut reposts = super::acts::reposts(store, &event.id)
        .filter_map(|repost| {
            // A muted actor still owns their already-published repost action.
            own_repost |= Some(repost.pubkey.as_str()) == account;
            if super::query::their_repost(store, query, &repost) {
                return None;
            }
            reposted_at = reposted_at.max(Some(repost.created_at));
            Some(author(store, &repost.pubkey))
        })
        .collect::<Vec<_>>();
    reposts.sort_by(|a, b| a.pubkey.cmp(&b.pubkey));
    reposts.dedup_by(|a, b| a.pubkey == b.pubkey);
    let own = Own {
        reposted: own_repost,
        bookmarked: super::settings::list_has(store, private, account, 10003, "e", &event.id),
        pinned: super::pins::contains(store, account, &event.id),
        muted: super::settings::list_has(store, private, account, 10000, "p", &event.pubkey),
    };
    Row {
        id: event.id.clone(),
        author: author(store, &event.pubkey),
        created_at: event.created_at,
        kind: event.kind,
        content,
        reply: crate::kinds::policy(event.kind)
            .thread_parent
            .then(|| reply_parent(event))
            .flatten()
            .filter(|id| {
                store.get(id).is_none_or(|e| {
                    crate::kinds::policy(e.kind).openable
                        && super::query_hidden::their_reason(store, query, &e).is_none()
                })
            })
            .map(|id| Context {
                author: store.get(&id).map(|e| author(store, &e.pubkey)),
                id,
            }),
        reposts,
        reposted_at,
        window_reading_at: None,
        warning: content_warning_reason(event),
        counts: Counts {
            replies,
            reposts: repost_count,
            reactions: reaction_count,
            partial: false,
        },
        reactions,
        hidden_reason: None,
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

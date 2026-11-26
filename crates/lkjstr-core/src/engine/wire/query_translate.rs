use super::*;
use crate::engine::protocol as p;
impl Query {
    pub fn convert(&self) -> Option<p::Query> {
        let source = match self.source.as_str() {
            "channels" => p::Source::Channels,
            "channel" => p::Source::Channel,
            "home" => p::Source::Home,
            "their-home" => p::Source::TheirHome,
            "people" => p::Source::People,
            "global" => p::Source::Global,
            "profile" => p::Source::Profile,
            "thread" => p::Source::Thread,
            "notifications" => p::Source::Notifications,
            "search" => p::Source::Search,
            "hashtag" => p::Source::Hashtag,
            "bookmarks" => p::Source::Bookmarks,
            "list" => p::Source::List,
            "relay" => p::Source::Relay,
            "followers" => p::Source::Followers,
            "following" => p::Source::Following,
            "mutes" => p::Source::Mutes,
            "relays" => p::Source::Relays,
            "diagnostics" => p::Source::Diagnostics,
            "media-servers" => p::Source::MediaServers,
            "emoji" => p::Source::Emoji,
            _ => return None,
        };
        let mut target = self
            .pubkey
            .clone()
            .or(self.id.clone())
            .or(self.tag.clone())
            .or(self.relay.clone());
        if source == p::Source::Relay {
            target = Some(crate::engine::settings::strict_relay(target.as_deref()?)?);
        }
        let reference = if source == p::Source::Channels {
            self.text.as_deref()
        } else {
            self.reference.as_deref()
        };
        let resolved = reference.and_then(|raw| resolve_reference(raw, source));
        if source == p::Source::Channels {
            target = resolved.as_ref().map(|r| r.0.clone());
        } else if target.is_none()
            && let Some(reference) = reference
        {
            target = Some(if source == p::Source::People {
                reference.to_owned()
            } else {
                resolved.as_ref()?.0.clone()
            });
        }
        Some(p::Query {
            source,
            account: self.account.clone(),
            target,
            filters: p::Filters {
                authors: self.authors.clone(),
                since: self.since.map(|v| v.div_ceil(1000)),
                until: self.until.map(|v| v / 1000),
                types: self.types.as_ref().map(|v| {
                    v.iter()
                        .map(|s| {
                            if s == "reply" {
                                "replies".into()
                            } else {
                                format!("{s}s")
                            }
                        })
                        .collect()
                }),
                media: self.media.as_ref().map(|s| s == "only"),
                replies: self.replies,
                reposts: self.reposts,
                language: None,
                languages: self.language.clone(),
                text: if source == p::Source::Channels && resolved.is_some() {
                    None
                } else {
                    self.text.clone()
                },
                relay_hints: resolved.map(|r| r.1).unwrap_or_default(),
                phrases: self.phrases.clone(),
                exclude: self.exclude.clone(),
                has: self.has.clone(),
                from: if self.source == "people" {
                    self.reference
                        .clone()
                        .map(|r| vec![r])
                        .or(self.from.clone())
                } else {
                    self.from.clone()
                },
                notifications: self.notifications,
                show: self.show.clone(),
            },
        })
    }
}

fn resolve_reference(raw: &str, source: p::Source) -> Option<(String, Vec<String>)> {
    use lkjstr_protocol::{NostrEntity, decode_nip19, is_event_id};
    if source == p::Source::Channels {
        return crate::engine::channels::reference(raw);
    }
    let raw = raw.trim().strip_prefix("nostr:").unwrap_or(raw.trim());
    if is_event_id(raw) {
        return Some((raw.to_owned(), vec![]));
    }
    let (target, hints) = match decode_nip19(raw)? {
        NostrEntity::Npub(pubkey) => (pubkey, None),
        NostrEntity::Nprofile(pointer) => (
            pointer.pubkey,
            pointer.relays.filter(|_| source == p::Source::Profile),
        ),
        NostrEntity::Note(id) => (id, None),
        NostrEntity::Nevent(pointer) => {
            if source == p::Source::Thread
                && pointer
                    .kind
                    .is_some_and(|kind| !crate::kinds::policy(kind).openable)
            {
                return None;
            }
            (pointer.id, pointer.relays)
        }
        NostrEntity::Naddr(pointer) => {
            if source == p::Source::Thread {
                let address = format!("{}:{}:{}", pointer.kind, pointer.pubkey, pointer.identifier);
                if !crate::kinds::policy(pointer.kind).openable
                    || lkjstr_nips::address::Coordinate::parse(&address).is_err()
                {
                    return None;
                }
            }
            (
                format!("{}:{}:{}", pointer.kind, pointer.pubkey, pointer.identifier),
                pointer.relays.filter(|_| source == p::Source::Thread),
            )
        }
        NostrEntity::Nsec(_) => return None,
    };
    Some((
        target,
        hints
            .into_iter()
            .flatten()
            .filter_map(|url| crate::engine::settings::strict_relay(&url))
            .take(8)
            .collect(),
    ))
}

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
        if target.is_none()
            && let Some(reference) = &self.reference
        {
            if self.source == "people" {
                target = Some(reference.clone());
            } else if let Some((id, _)) = crate::engine::channels::reference(reference) {
                target = Some(id);
            } else {
                target = Some(
                    match lkjstr_protocol::decode_nip19(
                        reference.strip_prefix("nostr:").unwrap_or(reference),
                    )? {
                        lkjstr_protocol::NostrEntity::Npub(p) => p,
                        lkjstr_protocol::NostrEntity::Nprofile(p) => p.pubkey,
                        lkjstr_protocol::NostrEntity::Note(id) => id,
                        lkjstr_protocol::NostrEntity::Nevent(p) => p.id,
                        lkjstr_protocol::NostrEntity::Naddr(p) => {
                            format!("{}:{}:{}", p.kind, p.pubkey, p.identifier)
                        }
                        _ => return None,
                    },
                );
            }
        }
        let reference = if source == p::Source::Channels {
            self.text.as_deref()
        } else {
            self.reference.as_deref()
        };
        let resolved = reference.and_then(crate::engine::channels::reference);
        if source == p::Source::Channels {
            target = resolved.as_ref().map(|r| r.0.clone());
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

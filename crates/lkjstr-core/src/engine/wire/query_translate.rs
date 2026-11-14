use super::*;
use crate::engine::protocol as p;
impl Query {
    pub fn convert(&self) -> Option<p::Query> {
        let source = match self.source.as_str() {
            "home" => p::Source::Home,
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
            "diagnostics" | "media-servers" | "emoji" => p::Source::Diagnostics,
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
            target = Some(
                match lkjstr_protocol::decode_nip19(
                    reference.strip_prefix("nostr:").unwrap_or(reference),
                )? {
                    lkjstr_protocol::NostrEntity::Npub(p) => p,
                    lkjstr_protocol::NostrEntity::Nprofile(p) => p.pubkey,
                    lkjstr_protocol::NostrEntity::Note(id) => id,
                    lkjstr_protocol::NostrEntity::Nevent(p) => p.id,
                    _ => return None,
                },
            );
        }
        Some(p::Query {
            source,
            account: self.account.clone(),
            target,
            filters: p::Filters {
                authors: self.authors.clone(),
                since: self.since.map(|v| v / 1000),
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
                language: self.language.as_ref().and_then(|v| v.first()).cloned(),
                text: self.text.clone(),
            },
        })
    }
}

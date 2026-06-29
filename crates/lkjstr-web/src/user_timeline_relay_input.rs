use std::collections::BTreeSet;

use lkjstr_app::{
    FeedWindowState, RowGeometryModel, UserTimelineFeedDiagnosticInput,
    UserTimelineFeedSourceState,
};
use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent, NostrFilter,
};
use lkjstr_relays::AuthorRelayRoute;

#[derive(Clone)]
pub(crate) struct UserTimelineRelayReadInput {
    pub(crate) owner: String,
    pub(crate) target_pubkey: String,
    pub(crate) selected_relays: Vec<String>,
    pub(crate) author_routes: Vec<AuthorRelayRoute>,
    pub(crate) relays: Vec<String>,
    pub(crate) target_posts_fallback: Option<UserTimelineTargetPostsFallback>,
}

#[derive(Clone)]
pub(crate) struct UserTimelineTargetPostsFallback {
    pub(crate) window: FeedWindowState,
    pub(crate) source_state: UserTimelineFeedSourceState,
    pub(crate) since: Option<u64>,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
    pub(crate) diagnostics: Vec<UserTimelineFeedDiagnosticInput>,
}

pub(crate) struct UserTimelineRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) target_pubkey: &'a str,
    pub(crate) selected_relays: &'a [String],
    pub(crate) author_routes: &'a [AuthorRelayRoute],
}

pub(crate) fn user_timeline_relay_input(
    seed: UserTimelineRelayInputSeed<'_>,
) -> Option<UserTimelineRelayReadInput> {
    let selected_relays = unique_sorted(seed.selected_relays.iter().cloned());
    let author_routes = seed.author_routes.to_vec();
    let relays = unique_sorted(
        selected_relays
            .iter()
            .cloned()
            .chain(author_routes.iter().map(|route| route.relay_url.clone())),
    );
    if relays.is_empty() {
        return None;
    }
    Some(UserTimelineRelayReadInput {
        owner: seed.owner.to_owned(),
        target_pubkey: seed.target_pubkey.to_owned(),
        selected_relays,
        author_routes,
        relays,
        target_posts_fallback: None,
    })
}

pub(crate) fn user_timeline_relay_filters(
    input: &UserTimelineRelayReadInput,
    relay: &str,
) -> Vec<NostrFilter> {
    if !input.relays.iter().any(|item| item == relay) {
        return Vec::new();
    }
    vec![
        NostrFilter {
            authors: Some(vec![input.target_pubkey.clone()]),
            kinds: Some(vec![KIND_FOLLOW_LIST]),
            limit: Some(1),
            ..NostrFilter::default()
        },
        NostrFilter {
            authors: Some(vec![input.target_pubkey.clone()]),
            kinds: Some(vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST]),
            limit: Some(crate::user_timeline_host::PAGE_SIZE),
            ..NostrFilter::default()
        },
    ]
}

pub(crate) fn user_timeline_event_matches_read(
    input: &UserTimelineRelayReadInput,
    event: &NostrEvent,
) -> bool {
    event.pubkey == input.target_pubkey
        && matches!(
            event.kind,
            KIND_FOLLOW_LIST | KIND_TEXT_NOTE | KIND_REPOST | KIND_GENERIC_REPOST
        )
}

fn unique_sorted(values: impl Iterator<Item = String>) -> Vec<String> {
    values.collect::<BTreeSet<_>>().into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_protocol::KIND_TEXT_NOTE;

    #[test]
    fn selected_relays_create_follow_list_filter() -> Result<(), &'static str> {
        let input = user_timeline_relay_input(UserTimelineRelayInputSeed {
            owner: "timeline-tab",
            target_pubkey: &pubkey("a"),
            selected_relays: &[
                "wss://b.example".to_owned(),
                "wss://a.example".to_owned(),
                "wss://b.example".to_owned(),
            ],
            author_routes: &[],
        })
        .ok_or("missing relay input")?;
        let filters = user_timeline_relay_filters(&input, "wss://a.example");

        assert_eq!(input.relays, vec!["wss://a.example", "wss://b.example"]);
        assert_eq!(
            filters.first().and_then(|filter| filter.kinds.clone()),
            Some(vec![KIND_FOLLOW_LIST])
        );
        assert_eq!(
            filters.first().and_then(|filter| filter.authors.clone()),
            Some(vec![pubkey("a")])
        );
        assert_eq!(filters.first().and_then(|filter| filter.limit), Some(1));
        Ok(())
    }

    #[test]
    fn match_accepts_target_follow_list_and_posts() -> Result<(), &'static str> {
        let input = user_timeline_relay_input(UserTimelineRelayInputSeed {
            owner: "timeline-tab",
            target_pubkey: &pubkey("a"),
            selected_relays: &["wss://a.example".to_owned()],
            author_routes: &[],
        })
        .ok_or("missing relay input")?;

        assert!(user_timeline_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("a"))
        ));
        assert!(user_timeline_event_matches_read(
            &input,
            &event(KIND_TEXT_NOTE, &pubkey("a"))
        ));
        assert!(!user_timeline_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("b"))
        ));
        Ok(())
    }

    #[test]
    fn author_routes_create_follow_list_filter() -> Result<(), &'static str> {
        let input = user_timeline_relay_input(UserTimelineRelayInputSeed {
            owner: "timeline-tab",
            target_pubkey: &pubkey("a"),
            selected_relays: &[],
            author_routes: &[AuthorRelayRoute {
                author: pubkey("a"),
                relay_url: "wss://author.example/".to_owned(),
                source: lkjstr_relays::RouteEvidenceSource::Nip65,
                score: 0,
            }],
        })
        .ok_or("missing route input")?;
        let filters = user_timeline_relay_filters(&input, "wss://author.example/");

        assert_eq!(input.relays, vec!["wss://author.example/"]);
        assert_eq!(
            filters.first().and_then(|filter| filter.authors.clone()),
            Some(vec![pubkey("a")])
        );
        Ok(())
    }

    fn event(kind: u64, pubkey: &str) -> NostrEvent {
        NostrEvent {
            id: "1".repeat(64),
            pubkey: pubkey.to_owned(),
            created_at: 3_000,
            kind,
            tags: Vec::new(),
            content: String::new(),
            sig: "f".repeat(128),
        }
    }

    fn pubkey(value: &str) -> String {
        value.repeat(64)
    }
}

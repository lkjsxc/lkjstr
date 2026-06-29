use lkjstr_app::feed_policy::{
    FeedRelayAvailability, public_read_route_availability, selected_relay_availability,
};
use lkjstr_relays::{AuthorRelayRoute, RouteEvidenceSource};

#[test]
fn public_read_policy_accepts_session_defaults_or_author_routes() {
    assert_eq!(
        public_read_route_availability(&["wss://relay.example".to_owned()], &[]),
        FeedRelayAvailability::Available
    );
    assert_eq!(
        public_read_route_availability(&[], &[author_route()]),
        FeedRelayAvailability::Available
    );
    assert_eq!(
        public_read_route_availability(&[], &[]),
        FeedRelayAvailability::NoRoute
    );
}

#[test]
fn protected_selected_relay_policy_requires_a_real_selected_relay() {
    assert_eq!(
        selected_relay_availability(&["wss://relay.example".to_owned()]),
        FeedRelayAvailability::Available
    );
    assert_eq!(
        selected_relay_availability(&[]),
        FeedRelayAvailability::NoRoute
    );
}

fn author_route() -> AuthorRelayRoute {
    AuthorRelayRoute {
        author: "a".repeat(64),
        relay_url: "wss://author.example".to_owned(),
        source: RouteEvidenceSource::Discovery,
        score: 1,
    }
}

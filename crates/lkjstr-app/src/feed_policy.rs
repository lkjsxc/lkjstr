#![doc = "Pure feed policy reducers shared by feed surfaces."]

use lkjstr_relays::AuthorRelayRoute;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedRelayAvailability {
    Available,
    NoRoute,
}

impl FeedRelayAvailability {
    #[must_use]
    pub const fn is_available(self) -> bool {
        matches!(self, Self::Available)
    }
}

#[must_use]
pub fn public_read_route_availability(
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
) -> FeedRelayAvailability {
    if selected_relays.is_empty() && author_routes.is_empty() {
        FeedRelayAvailability::NoRoute
    } else {
        FeedRelayAvailability::Available
    }
}

#[must_use]
pub fn public_read_routes_available(
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
) -> bool {
    public_read_route_availability(selected_relays, author_routes).is_available()
}

#[must_use]
pub fn selected_relay_availability(selected_relays: &[String]) -> FeedRelayAvailability {
    if selected_relays.is_empty() {
        FeedRelayAvailability::NoRoute
    } else {
        FeedRelayAvailability::Available
    }
}

#[must_use]
pub fn selected_relays_available(selected_relays: &[String]) -> bool {
    selected_relay_availability(selected_relays).is_available()
}

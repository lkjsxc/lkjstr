//! Public view links. Only view data is serialised; account secrets never enter.
use crate::View;

pub fn encode(view: &View) -> String {
    serde_json::to_string(view).unwrap_or_default()
}

pub fn decode(route: &str) -> Option<View> {
    if route.len() > 16_384 {
        return None;
    }
    let view: View = serde_json::from_str(route).ok()?;
    let valid = match &view {
        View::Thread { id, relays } => lkjstr_protocol::is_event_id(id) && relays.len() <= 12,
        View::Profile { pubkey } => lkjstr_protocol::is_pubkey(pubkey),
        View::Compose { reply_to: Some(id) } => lkjstr_protocol::is_event_id(id),
        View::Link { url } | View::Image { url } => url::Url::parse(url).is_ok_and(|url| {
            matches!(url.scheme(), "https" | "http")
                && url.username().is_empty()
                && url.password().is_none()
        }),
        View::Search { query } => query.len() <= 4096,
        _ => true,
    };
    valid.then_some(view)
}

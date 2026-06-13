#[must_use]
pub fn feed_event_row_id(event_id: &str) -> String {
    format!("event:{event_id}")
}

#[must_use]
pub fn feed_profile_row_id(pubkey: &str) -> String {
    format!("profile:{pubkey}")
}

#[must_use]
pub fn feed_notification_row_id(event_id: &str, kind: &str) -> String {
    format!("notification:{event_id}:{kind}")
}

#[must_use]
pub fn feed_continuation_row_id(target_event_id: &str) -> String {
    format!("continuation:{target_event_id}")
}

#[must_use]
pub fn feed_unavailable_row_id(reason: &str, subject: &str) -> String {
    format!("unavailable:{reason}:{subject}")
}

#[must_use]
pub fn feed_diagnostic_row_id(scope: &str, id: &str) -> String {
    format!("diagnostic:{scope}:{id}")
}

#[must_use]
pub fn feed_footer_row_id(feed_id: &str) -> String {
    format!("footer:{feed_id}")
}

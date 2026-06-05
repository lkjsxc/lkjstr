#[must_use]
pub fn fragment_key(event_id: &str, shape_hash: &str, fragment_kind: &str, index: u16) -> String {
    format!("event:{event_id}:shape:{shape_hash}:kind:{fragment_kind}:index:{index}")
}

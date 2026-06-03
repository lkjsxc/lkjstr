#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScanDirection {
    Older,
    Newer,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CursorPoint {
    pub created_at_seconds: u64,
    pub event_id: String,
}

impl CursorPoint {
    pub fn new(created_at_seconds: u64, event_id: impl Into<String>) -> Self {
        Self {
            created_at_seconds,
            event_id: event_id.into(),
        }
    }
}

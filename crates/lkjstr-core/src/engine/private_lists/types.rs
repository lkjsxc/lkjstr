//! Public metadata only; decrypted entries live in the engine's existing private map.
use lkjstr_nips::list_read::Format;
use serde::Serialize;
pub const MAX_RECORDS: usize = 128;
pub const MAX_BYTES: usize = 16 * 1024 * 1024;
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Access {
    pub authority: u64,
    pub local: bool,
    pub error: Option<&'static str>,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Demand {
    pub client: u64,
    pub sub: String,
    pub account: String,
    pub events: Vec<String>,
    pub external: bool,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Job {
    pub token: u64,
    pub client: u64,
    pub sub: String,
    pub account: String,
    pub epoch: u64,
    pub event: String,
    pub format: Format,
    pub deadline: u64,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct Status {
    pub phase: &'static str,
    pub pending: usize,
    pub failed: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<&'static str>,
}
impl Default for Status {
    fn default() -> Self {
        Self {
            phase: "ready",
            pending: 0,
            failed: 0,
            error: None,
        }
    }
}
pub(super) enum Phase {
    Pending,
    Running(Job),
    Ready,
    Failed(&'static str),
}
pub(super) struct Record {
    pub account: String,
    pub epoch: u64,
    pub format: Option<Format>,
    pub phase: Phase,
    pub bytes: usize,
}

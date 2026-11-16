//! Read-only observations, not physical disk accounting. All times are Worker
//! performance-clock milliseconds; they are neither UTC nor cross-Worker clocks.
use serde::Serialize;
pub const MAX_SAFE: u64 = (1_u64 << 53) - 1;
pub const DEADLINE_MS: u64 = 15_000;
pub const MAX_JOBS: usize = 4;
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    pub events: u64,
    pub event_payload_bytes: u64,
    pub at: u64,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "phase", rename_all = "kebab-case")]
pub enum Count {
    Ready { count: u64, at: u64 },
    Unsupported,
    Failed,
    Timeout,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "phase", rename_all = "kebab-case")]
pub enum Origin {
    Ready {
        usage: u64,
        quota: u64,
        at: u64,
        approximate: bool,
    },
    Unsupported,
    Failed,
    Timeout,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub started_at: u64,
    pub finished_at: u64,
    pub memory: Memory,
    pub persisted_events: Count,
    pub origin: Origin,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Lease {
    pub client: u64,
    pub req: String,
    pub(super) token: u64,
    pub deadline: u64,
}
#[derive(Debug)]
pub struct Reply {
    pub lease: Lease,
    pub report: Report,
}
impl Count {
    pub(super) fn checked(self, start: u64, now: u64) -> Self {
        match self {
            Self::Ready { count, at } if count > MAX_SAFE || at < start || at > now => Self::Failed,
            value => value,
        }
    }
}
impl Origin {
    pub(super) fn checked(self, start: u64, now: u64) -> Self {
        match self {
            Self::Ready { usage, quota, at, approximate }
                if usage > MAX_SAFE || quota > MAX_SAFE || at < start || at > now || !approximate => Self::Failed,
            value => value,
        }
    }
}

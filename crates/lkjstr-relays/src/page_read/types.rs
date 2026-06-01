#![doc = "Progressive page-read state types."]

use std::collections::BTreeMap;

use super::{PageReadSurface, ProgressiveEvent};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProgressiveReadStatus {
    Idle,
    CacheReady,
    Partial,
    Complete,
    Incomplete,
    Failed,
    Cancelled,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProgressiveRelayState {
    Pending,
    Connected,
    Reading,
    Eose,
    Timeout,
    Closed,
    Auth,
    Error,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProgressiveRelaySnapshot {
    pub relay: String,
    pub state: ProgressiveRelayState,
    pub event_count: u64,
    pub final_count: u64,
    pub duration_ms: Option<u64>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProgressiveReadState {
    pub read_id: String,
    pub surface: Option<PageReadSurface>,
    pub started_at_ms: u64,
    pub relays: Vec<String>,
    pub events: Vec<ProgressiveEvent>,
    pub relay_states: BTreeMap<String, ProgressiveRelaySnapshot>,
    pub cache_ready: bool,
    pub final_read: bool,
    pub status: ProgressiveReadStatus,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InitialProgressiveRead {
    pub read_id: String,
    pub surface: Option<PageReadSurface>,
    pub relays: Vec<String>,
    pub started_at_ms: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProgressiveReadEvidence {
    CacheReady(Vec<ProgressiveEvent>),
    RelayEvents(Vec<ProgressiveEvent>),
    RelayStatuses(Vec<ReadPageRelayStatus>),
    Timeout,
    Cancel,
    Finalize(Vec<ReadPageRelayStatus>),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReadPageRelayStatus {
    pub relay: String,
    pub eose: bool,
    pub timeout: bool,
    pub closed: bool,
    pub auth: bool,
    pub socket_closed: bool,
    pub socket_error: bool,
    pub event_limit_reached: bool,
    pub aborted: bool,
    pub duration_ms: u64,
    pub candidate_count: u64,
    pub final_count: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProgressiveReadSnapshot {
    pub read_id: String,
    pub surface: Option<PageReadSurface>,
    pub status: ProgressiveReadStatus,
    pub reason: String,
    pub events: Vec<ProgressiveEvent>,
    pub relays: Vec<ProgressiveRelaySnapshot>,
    pub started_at_ms: u64,
    pub updated_at_ms: u64,
    pub duration_ms: u64,
    pub final_read: bool,
}

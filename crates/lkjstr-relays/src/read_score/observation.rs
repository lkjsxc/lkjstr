use super::key::RelayReadScoreKey;

#[derive(Clone, Debug, PartialEq)]
pub struct RelayReadObservation {
    pub key: RelayReadScoreKey,
    pub started_at_ms: u64,
    pub first_event_ms: Option<u64>,
    pub eose_ms: Option<u64>,
    pub duration_ms: u64,
    pub event_count: u64,
    pub unique_event_count: u64,
    pub final_count: u64,
    pub timeout: bool,
    pub closed: bool,
    pub auth: bool,
    pub socket_error: bool,
    pub event_limit_reached: bool,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub updated_at_ms: u64,
}

impl RelayReadObservation {
    pub fn terminal_failure(&self) -> bool {
        self.timeout || self.closed || self.auth || self.socket_error
    }

    pub fn completed_without_failure(&self) -> bool {
        self.eose_ms.is_some() && !self.terminal_failure()
    }

    pub fn produced_event_before_timeout(&self) -> bool {
        self.event_count > 0 && !self.timeout
    }
}

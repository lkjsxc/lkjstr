use super::cursor::ScanDirection;

#[derive(Clone, Debug, PartialEq)]
pub struct ScanSegmentObservation {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirection,
    pub route_fingerprint: String,
    pub since_seconds: u64,
    pub until_seconds: u64,
    pub requested_limit: u16,
    pub effective_limit: u16,
    pub event_count: u16,
    pub unique_event_count: u16,
    pub final_visible_count: u16,
    pub event_limit_reached: bool,
    pub eose: bool,
    pub timeout: bool,
    pub closed: bool,
    pub auth: bool,
    pub socket_error: bool,
    pub bytes_sent: u32,
    pub bytes_received: u32,
    pub started_at_ms: u64,
    pub completed_at_ms: u64,
}

impl ScanSegmentObservation {
    #[must_use]
    pub fn span_seconds(&self) -> u64 {
        self.until_seconds.saturating_sub(self.since_seconds).max(1)
    }

    #[must_use]
    pub fn is_failure(&self) -> bool {
        self.timeout || self.closed || self.auth || self.socket_error
    }

    #[must_use]
    pub fn is_complete(&self) -> bool {
        self.eose && !self.is_failure()
    }

    #[must_use]
    pub fn is_incomplete(&self) -> bool {
        !self.is_complete()
    }

    #[must_use]
    pub fn observed_density_events_per_second(&self) -> Option<f64> {
        let span = self.span_seconds() as f64;
        if self.event_limit_reached {
            Some(f64::from(self.effective_limit.max(1)) / span)
        } else if self.is_complete() {
            Some(f64::from(self.final_visible_count) / span)
        } else {
            weak_incomplete_count(self).map(|count| f64::from(count) / span)
        }
    }
}

fn weak_incomplete_count(observation: &ScanSegmentObservation) -> Option<u16> {
    let count = observation
        .final_visible_count
        .max(observation.unique_event_count)
        .max(observation.event_count);
    if count == 0 { None } else { Some(count) }
}

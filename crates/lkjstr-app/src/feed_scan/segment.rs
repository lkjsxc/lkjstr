use super::cursor::{CursorPoint, ScanDirection};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanSegment {
    pub since_seconds: u64,
    pub until_seconds: u64,
    pub span_seconds: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SegmentSplitOutcome {
    Split(Vec<ScanSegment>),
    Unresolved(ScanSegment),
}

impl ScanSegment {
    pub fn new(since_seconds: u64, until_seconds: u64) -> Self {
        Self {
            since_seconds,
            until_seconds,
            span_seconds: until_seconds.saturating_sub(since_seconds),
        }
    }

    pub fn can_split(&self, min_span_seconds: u64) -> bool {
        self.span_seconds > min_span_seconds && self.until_seconds > self.since_seconds + 1
    }
}

pub fn segment_from_edge(
    direction: &ScanDirection,
    edge: &CursorPoint,
    span_seconds: u64,
) -> ScanSegment {
    match direction {
        ScanDirection::Older => ScanSegment::new(
            edge.created_at_seconds.saturating_sub(span_seconds),
            edge.created_at_seconds,
        ),
        ScanDirection::Newer => ScanSegment::new(
            edge.created_at_seconds,
            edge.created_at_seconds.saturating_add(span_seconds),
        ),
    }
}

pub fn split_limit_hit_segment(
    segment: &ScanSegment,
    direction: &ScanDirection,
    min_span_seconds: u64,
) -> SegmentSplitOutcome {
    if !segment.can_split(min_span_seconds) {
        return SegmentSplitOutcome::Unresolved(segment.clone());
    }
    let midpoint = segment.since_seconds + segment.span_seconds / 2;
    let lower = ScanSegment::new(segment.since_seconds, midpoint);
    let upper = ScanSegment::new(midpoint, segment.until_seconds);
    let ordered = match direction {
        ScanDirection::Older => vec![upper, lower],
        ScanDirection::Newer => vec![lower, upper],
    };
    SegmentSplitOutcome::Split(ordered)
}

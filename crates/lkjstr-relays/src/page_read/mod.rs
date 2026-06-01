#![doc = "Pure page-read dedupe and progressive snapshot reducers."]

mod dedupe;
mod events;
mod intent;
mod progressive;
mod progressive_tail;
mod types;

pub use dedupe::{
    page_read_bounds, page_read_semantic_key, read_dedupe_key, route_group_fingerprint,
    subscription_key,
};
pub use events::{ProgressiveEvent, event_relays, merge_progressive_events};
pub use intent::{
    FeedCursorPoint, PageReadBounds, PageReadDirection, PageReadIntent, PageReadPhase,
    PageReadPurpose, PageReadSurface, ReadDedupeOptions, RelayReadRequest, RelayRouteGroup,
};
pub use progressive::{
    initial_progressive_read, progressive_read_snapshot, progressive_status,
    reduce_progressive_read, relay_snapshot_from_status,
};
pub use types::{
    InitialProgressiveRead, ProgressiveReadEvidence, ProgressiveReadSnapshot, ProgressiveReadState,
    ProgressiveReadStatus, ProgressiveRelaySnapshot, ProgressiveRelayState, ReadPageRelayStatus,
};

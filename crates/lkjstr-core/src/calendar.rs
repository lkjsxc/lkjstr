//! The reader's local calendar. The core has no clock or zone database: the Worker supplies the
//! browser's own `Date` (lkjstr-engine-worker/src/worker_calendar.rs), and native code uses UTC.

/// Local days, as the page's zone sees them.
pub trait Calendar {
    /// The IANA name of the zone the days are in.
    fn zone(&self) -> String;
    /// Start (ms since the epoch, clamped at 0) of the local day holding `ms`. A 23-hour or
    /// 25-hour day is one day; a day whose midnight is skipped starts at its first instant.
    fn day_start(&self, ms: u64) -> u64;
    /// Start of the occupied five-minute wall-clock bucket, clamped to epoch zero.
    fn five_minute_start(&self, ms: u64) -> u64 {
        ms - ms % 300_000
    }
}

/// UTC days: the native default, and what a page in UTC sees.
pub struct Utc;

const DAY: u64 = 86_400_000;

impl Calendar for Utc {
    fn zone(&self) -> String {
        "UTC".into()
    }
    fn day_start(&self, ms: u64) -> u64 {
        ms - ms % DAY
    }
}

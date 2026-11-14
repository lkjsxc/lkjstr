//! Raw query progress is independent of rows hidden by presentation filters.
pub const PAGE_SIZE: usize = 40;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Page {
    pub count: usize,
    pub oldest: Option<u64>,
    /// Already cached events at the inclusive timestamp boundary.
    pub at_oldest: usize,
}

impl Page {
    /// Underfilled displays advance without a scroll event. Include the entire
    /// timestamp boundary plus a fresh page so tied timestamps are not skipped.
    /// Increasing the local query limit after each request bounds repeated work.
    pub fn next(
        self,
        limit: usize,
        before: Option<u64>,
        settled: bool,
        needs_rows: bool,
        cap: usize,
    ) -> Option<(u64, usize)> {
        let oldest = self.oldest?;
        (settled && needs_rows && self.count >= limit && limit < cap)
            .then_some((oldest, (self.at_oldest + PAGE_SIZE).min(cap)))
            .filter(|(cursor, _)| before.is_none_or(|old| *cursor <= old))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TargetFollowListState {
    Idle,
    CacheHit,
    ReadingSelected,
    ReadingAuthorRoutes,
    ReadingReceiptRoutes,
    ReadingDiscovery,
    Found,
    EmptyFollowList,
    NotFoundProven,
    PartialFailure,
    AllFailed,
    Aborted,
}

impl TargetFollowListState {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::CacheHit => "cache_hit",
            Self::ReadingSelected => "reading_selected",
            Self::ReadingAuthorRoutes => "reading_author_routes",
            Self::ReadingReceiptRoutes => "reading_receipt_routes",
            Self::ReadingDiscovery => "reading_discovery",
            Self::Found => "found",
            Self::EmptyFollowList => "empty_follow_list",
            Self::NotFoundProven => "not_found_proven",
            Self::PartialFailure => "partial_failure",
            Self::AllFailed => "all_failed",
            Self::Aborted => "aborted",
        }
    }
}

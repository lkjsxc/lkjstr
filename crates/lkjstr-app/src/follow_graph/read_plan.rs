#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FollowListReadPhase {
    Selected,
    AuthorRoutes,
    ReceiptRoutes,
    Discovery,
}

impl FollowListReadPhase {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Selected => "selected",
            Self::AuthorRoutes => "author_routes",
            Self::ReceiptRoutes => "receipt_routes",
            Self::Discovery => "discovery",
        }
    }
}

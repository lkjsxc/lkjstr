//! Class weights for page-owned extension work. Transport admission still owns the browser slot.
#[derive(Clone, Copy)]
pub enum SignerWork {
    Publish,
    UserAction,
    Visible,
    Background,
    LazyList,
}
impl SignerWork {
    pub const fn weight(self) -> u8 {
        match self {
            Self::Publish => 16,
            Self::UserAction => 8,
            Self::Visible => 4,
            Self::Background => 2,
            Self::LazyList => 1,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WidthBucket {
    Under320,
    W320To479,
    W480To639,
    W640To799,
    W800To1023,
    W1024Plus,
}

impl WidthBucket {
    #[must_use]
    pub fn from_width_px(width_px: u16) -> Self {
        match width_px {
            0..=319 => Self::Under320,
            320..=479 => Self::W320To479,
            480..=639 => Self::W480To639,
            640..=799 => Self::W640To799,
            800..=1023 => Self::W800To1023,
            _ => Self::W1024Plus,
        }
    }

    #[must_use]
    pub fn as_key(self) -> &'static str {
        match self {
            Self::Under320 => "0-319",
            Self::W320To479 => "320-479",
            Self::W480To639 => "480-639",
            Self::W640To799 => "640-799",
            Self::W800To1023 => "800-1023",
            Self::W1024Plus => "1024+",
        }
    }

    #[must_use]
    pub fn as_model_bucket(self) -> u16 {
        match self {
            Self::Under320 => 0,
            Self::W320To479 => 1,
            Self::W480To639 => 2,
            Self::W640To799 => 3,
            Self::W800To1023 => 4,
            Self::W1024Plus => 5,
        }
    }
}

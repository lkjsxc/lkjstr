use std::fmt;

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum ProtocolError {
    InvalidHex,
    InvalidUtf8,
    Json(String),
}

impl fmt::Display for ProtocolError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidHex => formatter.write_str("invalid lowercase hex"),
            Self::InvalidUtf8 => formatter.write_str("invalid utf-8"),
            Self::Json(message) => write!(formatter, "json error: {message}"),
        }
    }
}

impl std::error::Error for ProtocolError {}

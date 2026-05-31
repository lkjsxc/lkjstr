use serde_json::Value;

use crate::{MessageErrorCode, MessageParseError, RelayMessage};

pub(crate) fn one_string(
    items: &[Value],
    build: fn(String) -> RelayMessage,
    label: &str,
) -> Result<RelayMessage, MessageParseError> {
    if items.len() != 2 {
        return error(
            MessageErrorCode::BadShape,
            format!("{label} message has invalid length"),
        );
    }
    string_at(items, 1).map(build).ok_or_else(|| {
        parse_error(
            MessageErrorCode::BadShape,
            format!("{label} field is invalid"),
        )
    })
}

pub(crate) fn two_strings<F>(
    items: &[Value],
    build: F,
    label: &str,
) -> Result<RelayMessage, MessageParseError>
where
    F: FnOnce(String, String) -> RelayMessage,
{
    if items.len() != 3 {
        return error(
            MessageErrorCode::BadShape,
            format!("{label} message has invalid length"),
        );
    }
    match (string_at(items, 1), string_at(items, 2)) {
        (Some(first), Some(second)) => Ok(build(first, second)),
        _ => error(
            MessageErrorCode::BadShape,
            format!("{label} field is invalid"),
        ),
    }
}

pub(crate) fn string_at(items: &[Value], index: usize) -> Option<String> {
    items.get(index)?.as_str().map(ToOwned::to_owned)
}

pub(crate) fn bool_at(items: &[Value], index: usize) -> Option<bool> {
    items.get(index)?.as_bool()
}

pub(crate) fn error<T>(
    code: MessageErrorCode,
    message: impl Into<String>,
) -> Result<T, MessageParseError> {
    Err(parse_error(code, message))
}

pub(crate) fn parse_error(code: MessageErrorCode, message: impl Into<String>) -> MessageParseError {
    let message = message.into();
    MessageParseError {
        code,
        message: if message.is_empty() {
            "relay message is not valid JSON".to_owned()
        } else {
            message
        },
    }
}

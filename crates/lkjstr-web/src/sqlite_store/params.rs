#![doc = "SQLite worker parameter helpers."]

use crate::storage_worker::{SqlParams, SqlScalar};

#[must_use]
pub fn text(value: impl Into<String>) -> SqlScalar {
    SqlScalar::Text(value.into())
}

#[must_use]
pub fn opt_text(value: Option<String>) -> SqlScalar {
    value.map_or(SqlScalar::Null, SqlScalar::Text)
}

#[must_use]
pub fn integer(value: u64) -> SqlScalar {
    SqlScalar::Integer(i64::try_from(value).unwrap_or(i64::MAX))
}

#[must_use]
pub fn raw_integer(value: i64) -> SqlScalar {
    SqlScalar::Integer(value)
}

#[must_use]
pub fn no_params() -> Option<SqlParams> {
    None
}

#[must_use]
pub fn params(values: Vec<SqlScalar>) -> Option<SqlParams> {
    Some(values)
}

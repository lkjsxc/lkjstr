#![doc = "SQLite cached-event parameter helpers."]

use lkjstr_storage::{SqliteEventRelayRow, SqliteEventRow, SqliteEventTagRow};

use crate::{
    sqlite_store::params::{integer, opt_text, params, text},
    storage_worker::SqlParams,
};

pub fn event_params(row: SqliteEventRow) -> Option<SqlParams> {
    params(vec![
        text(row.event_id),
        text(row.pubkey),
        integer(row.kind),
        integer(row.created_at),
        text(row.sig),
        text(row.content),
        text(row.raw_json),
        integer(row.received_at_ms),
        integer(row.updated_at_ms),
    ])
}

pub fn tag_params(row: SqliteEventTagRow) -> Option<SqlParams> {
    params(vec![
        text(row.event_id),
        integer(row.tag_index),
        text(row.tag_name),
        opt_text(row.value_0),
        opt_text(row.value_1),
        opt_text(row.value_2),
        text(row.raw_json),
    ])
}

pub fn relay_params(row: SqliteEventRelayRow) -> Option<SqlParams> {
    params(vec![
        text(row.event_id),
        text(row.relay_url),
        integer(row.first_seen_at_ms),
        integer(row.last_seen_at_ms),
        text(row.source_kind),
    ])
}

#![doc = "SQLite Search repository statement records."]

use crate::{StorageOperation as Op, sql::SqliteStatementSpec};

pub const SEARCH_STATEMENTS: &[SqliteStatementSpec] = &[
    read(
        "event_search_tokens.by_token",
        "event_search_tokens",
        "SELECT event_id, token, position, created_at, kind, pubkey FROM event_search_tokens WHERE token = ?1 ORDER BY created_at DESC, event_id ASC LIMIT ?2;",
    ),
    read(
        "event_search_tokens.by_token_before",
        "event_search_tokens",
        "SELECT event_id, token, position, created_at, kind, pubkey FROM event_search_tokens WHERE token = ?1 AND (created_at < ?2 OR (created_at = ?2 AND event_id > ?3)) ORDER BY created_at DESC, event_id ASC LIMIT ?4;",
    ),
    write(
        "event_search_tokens.delete_by_event",
        "event_search_tokens",
        "DELETE FROM event_search_tokens WHERE event_id = ?1;",
    ),
    write(
        "event_search_tokens.upsert",
        "event_search_tokens",
        "INSERT INTO event_search_tokens (event_id, token, position, created_at, kind, pubkey) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(event_id, position) DO UPDATE SET token = excluded.token, created_at = excluded.created_at, kind = excluded.kind, pubkey = excluded.pubkey;",
    ),
];

const fn read(id: &'static str, table: &'static str, sql: &'static str) -> SqliteStatementSpec {
    statement(id, table, sql, Op::Read)
}

const fn write(id: &'static str, table: &'static str, sql: &'static str) -> SqliteStatementSpec {
    statement(id, table, sql, Op::Write)
}

const fn statement(
    id: &'static str,
    table_name: &'static str,
    sql: &'static str,
    operation: Op,
) -> SqliteStatementSpec {
    SqliteStatementSpec {
        id,
        sql,
        table_name,
        operation,
    }
}

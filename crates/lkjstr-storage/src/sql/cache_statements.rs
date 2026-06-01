#![doc = "SQLite cache repository statement records."]

use crate::{StorageOperation as Op, sql::SqliteStatementSpec};

pub const CACHE_STATEMENTS: &[SqliteStatementSpec] = &[
    read(
        "events.select",
        "events",
        "SELECT event_id, pubkey, kind, created_at, sig, content, raw_json, received_at_ms, updated_at_ms FROM events WHERE event_id = ?1;",
    ),
    read(
        "events.by_kind_time",
        "events",
        "SELECT event_id, pubkey, kind, created_at, sig, content, raw_json, received_at_ms, updated_at_ms FROM events WHERE kind = ?1 AND created_at < ?2 ORDER BY created_at DESC, event_id ASC LIMIT ?3;",
    ),
    read(
        "events.by_pubkey_kind_time",
        "events",
        "SELECT event_id, pubkey, kind, created_at, sig, content, raw_json, received_at_ms, updated_at_ms FROM events WHERE pubkey = ?1 AND kind = ?2 AND created_at < ?3 ORDER BY created_at DESC, event_id ASC LIMIT ?4;",
    ),
    read(
        "events.by_tag_value",
        "events",
        "SELECT e.event_id, e.pubkey, e.kind, e.created_at, e.sig, e.content, e.raw_json, e.received_at_ms, e.updated_at_ms FROM event_tags t JOIN events e ON e.event_id = t.event_id WHERE t.tag_name = ?1 AND t.value_0 = ?2 ORDER BY e.created_at DESC, e.event_id ASC LIMIT ?3;",
    ),
    write(
        "events.upsert",
        "events",
        "INSERT INTO events (event_id, pubkey, kind, created_at, sig, content, raw_json, received_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(event_id) DO UPDATE SET pubkey = excluded.pubkey, kind = excluded.kind, created_at = excluded.created_at, sig = excluded.sig, content = excluded.content, raw_json = excluded.raw_json, received_at_ms = excluded.received_at_ms, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "event_tags.by_event",
        "event_tags",
        "SELECT event_id, tag_index, tag_name, value_0, value_1, value_2, raw_json FROM event_tags WHERE event_id = ?1 ORDER BY tag_index ASC;",
    ),
    write(
        "event_tags.delete_by_event",
        "event_tags",
        "DELETE FROM event_tags WHERE event_id = ?1;",
    ),
    write(
        "event_tags.upsert",
        "event_tags",
        "INSERT INTO event_tags (event_id, tag_index, tag_name, value_0, value_1, value_2, raw_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(event_id, tag_index) DO UPDATE SET tag_name = excluded.tag_name, value_0 = excluded.value_0, value_1 = excluded.value_1, value_2 = excluded.value_2, raw_json = excluded.raw_json;",
    ),
    read(
        "event_relays.by_event",
        "event_relays",
        "SELECT event_id, relay_url, first_seen_at_ms, last_seen_at_ms, source_kind FROM event_relays WHERE event_id = ?1 ORDER BY relay_url ASC;",
    ),
    write(
        "event_relays.upsert",
        "event_relays",
        "INSERT INTO event_relays (event_id, relay_url, first_seen_at_ms, last_seen_at_ms, source_kind) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(event_id, relay_url) DO UPDATE SET first_seen_at_ms = CASE WHEN event_relays.first_seen_at_ms < excluded.first_seen_at_ms THEN event_relays.first_seen_at_ms ELSE excluded.first_seen_at_ms END, last_seen_at_ms = CASE WHEN event_relays.last_seen_at_ms > excluded.last_seen_at_ms THEN event_relays.last_seen_at_ms ELSE excluded.last_seen_at_ms END, source_kind = excluded.source_kind;",
    ),
    read(
        "notifications.by_owner",
        "notifications",
        "SELECT notification_id, owner_pubkey, source_event_id, target_event_id, root_event_id, actor_pubkey, notification_kind, created_at, read_at_ms, updated_at_ms FROM notifications WHERE owner_pubkey = ?1 AND created_at < ?2 ORDER BY created_at DESC, notification_id ASC LIMIT ?3;",
    ),
    write(
        "notifications.upsert",
        "notifications",
        "INSERT INTO notifications (notification_id, owner_pubkey, source_event_id, target_event_id, root_event_id, actor_pubkey, notification_kind, created_at, read_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(notification_id) DO UPDATE SET owner_pubkey = excluded.owner_pubkey, source_event_id = excluded.source_event_id, target_event_id = excluded.target_event_id, root_event_id = excluded.root_event_id, actor_pubkey = excluded.actor_pubkey, notification_kind = excluded.notification_kind, created_at = excluded.created_at, read_at_ms = excluded.read_at_ms, updated_at_ms = excluded.updated_at_ms;",
    ),
    write(
        "notifications.mark_owner_read",
        "notifications",
        "UPDATE notifications SET read_at_ms = ?2, updated_at_ms = ?2 WHERE owner_pubkey = ?1 AND read_at_ms IS NULL;",
    ),
    read(
        "feed_cursors.select",
        "feed_cursors",
        "SELECT cursor_id, feed_key, relay_set_key, direction, cursor_json, updated_at_ms FROM feed_cursors WHERE cursor_id = ?1;",
    ),
    write(
        "feed_cursors.upsert",
        "feed_cursors",
        "INSERT INTO feed_cursors (cursor_id, feed_key, relay_set_key, direction, cursor_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(cursor_id) DO UPDATE SET feed_key = excluded.feed_key, relay_set_key = excluded.relay_set_key, direction = excluded.direction, cursor_json = excluded.cursor_json, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "feed_coverage.by_feed",
        "feed_coverage",
        "SELECT coverage_id, feed_key, relay_url, filter_fingerprint, since_exclusive, until_exclusive, completed_at_ms, event_count, dense FROM feed_coverage WHERE feed_key = ?1 ORDER BY completed_at_ms DESC, coverage_id ASC;",
    ),
    write(
        "feed_coverage.upsert",
        "feed_coverage",
        "INSERT INTO feed_coverage (coverage_id, feed_key, relay_url, filter_fingerprint, since_exclusive, until_exclusive, completed_at_ms, event_count, dense) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(coverage_id) DO UPDATE SET feed_key = excluded.feed_key, relay_url = excluded.relay_url, filter_fingerprint = excluded.filter_fingerprint, since_exclusive = excluded.since_exclusive, until_exclusive = excluded.until_exclusive, completed_at_ms = excluded.completed_at_ms, event_count = excluded.event_count, dense = excluded.dense;",
    ),
    write(
        "feed_coverage.delete_by_feed",
        "feed_coverage",
        "DELETE FROM feed_coverage WHERE feed_key = ?1;",
    ),
    write(
        "feed_coverage.delete_all",
        "feed_coverage",
        "DELETE FROM feed_coverage;",
    ),
    read(
        "feed_scan_hints.by_feed",
        "feed_scan_hints",
        "SELECT hint_id, feed_key, relay_url, filter_fingerprint, span_seconds, updated_at_ms, expires_at_ms FROM feed_scan_hints WHERE feed_key = ?1 AND expires_at_ms > ?2 ORDER BY updated_at_ms DESC, hint_id ASC LIMIT ?3;",
    ),
    write(
        "feed_scan_hints.upsert",
        "feed_scan_hints",
        "INSERT INTO feed_scan_hints (hint_id, feed_key, relay_url, filter_fingerprint, span_seconds, updated_at_ms, expires_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(hint_id) DO UPDATE SET feed_key = excluded.feed_key, relay_url = excluded.relay_url, filter_fingerprint = excluded.filter_fingerprint, span_seconds = excluded.span_seconds, updated_at_ms = excluded.updated_at_ms, expires_at_ms = excluded.expires_at_ms;",
    ),
    write(
        "feed_scan_hints.delete_expired",
        "feed_scan_hints",
        "DELETE FROM feed_scan_hints WHERE expires_at_ms <= ?1;",
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

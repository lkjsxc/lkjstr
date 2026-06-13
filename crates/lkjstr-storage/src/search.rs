#![doc = "Storage-owned local Search token rows."]

use lkjstr_protocol::NostrEvent;
use serde::{Deserialize, Serialize};

pub const SEARCH_MAX_TOKEN_LENGTH: usize = 64;
pub const SEARCH_MAX_EVENT_TOKENS: usize = 512;
pub const SEARCH_MAX_QUERY_TOKENS: usize = 16;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteEventSearchTokenRow {
    pub event_id: String,
    pub token: String,
    pub position: u64,
    pub created_at: u64,
    pub kind: u64,
    pub pubkey: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SearchCursor {
    pub created_at: u64,
    pub event_id: String,
}

#[must_use]
pub fn normalize_search_text(text: &str) -> String {
    text.to_lowercase()
}

#[must_use]
pub fn tokenize_search_text(text: &str) -> Vec<String> {
    let normalized = normalize_search_text(text);
    let chars = normalized.chars().collect::<Vec<_>>();
    let mut tokens = Vec::new();
    let mut current = String::new();
    for (index, ch) in chars.iter().copied().enumerate() {
        let next = chars.get(index + 1).copied();
        if ch.is_alphanumeric() || is_joiner(ch) && can_join(&current, next) {
            push_token_char(&mut current, ch);
        } else {
            finish_token(&mut current, &mut tokens);
        }
    }
    finish_token(&mut current, &mut tokens);
    tokens
}

#[must_use]
pub fn tokenize_search_query(query: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    for token in tokenize_search_text(query) {
        if !tokens.contains(&token) {
            tokens.push(token);
        }
        if tokens.len() == SEARCH_MAX_QUERY_TOKENS {
            break;
        }
    }
    tokens
}

#[must_use]
pub fn event_search_token_rows(event: &NostrEvent) -> Vec<SqliteEventSearchTokenRow> {
    tokenize_search_text(&event.content)
        .into_iter()
        .take(SEARCH_MAX_EVENT_TOKENS)
        .enumerate()
        .map(|(index, token)| SqliteEventSearchTokenRow {
            event_id: event.id.clone(),
            token,
            position: index as u64,
            created_at: event.created_at,
            kind: event.kind,
            pubkey: event.pubkey.clone(),
        })
        .collect()
}

#[must_use]
pub fn search_candidate_row_limit(limit: u64) -> u64 {
    limit.max(limit.saturating_mul(5).min(500))
}

#[must_use]
pub fn local_search_event_ids(
    row_groups: &[Vec<SqliteEventSearchTokenRow>],
    limit: u64,
) -> Vec<String> {
    local_search_event_ids_before(row_groups, limit, None)
}

#[must_use]
pub fn local_search_event_ids_before(
    row_groups: &[Vec<SqliteEventSearchTokenRow>],
    limit: u64,
    before: Option<&SearchCursor>,
) -> Vec<String> {
    if row_groups.is_empty() || limit == 0 {
        return Vec::new();
    }
    let mut ids = Vec::new();
    for row in &row_groups[0] {
        if before.is_some_and(|cursor| !search_row_before(row, cursor)) {
            continue;
        }
        if ids.iter().any(|id| id == &row.event_id) {
            continue;
        }
        if row_groups[1..]
            .iter()
            .all(|group| has_event(group, &row.event_id))
        {
            ids.push(row.event_id.clone());
        }
        if ids.len() as u64 == limit {
            break;
        }
    }
    ids
}

#[must_use]
pub fn search_row_before(row: &SqliteEventSearchTokenRow, cursor: &SearchCursor) -> bool {
    row.created_at < cursor.created_at
        || row.created_at == cursor.created_at && row.event_id > cursor.event_id
}

fn push_token_char(current: &mut String, ch: char) {
    if current.len() < SEARCH_MAX_TOKEN_LENGTH {
        current.push(ch);
    }
}

fn finish_token(current: &mut String, tokens: &mut Vec<String>) {
    trim_trailing_joiner(current);
    if !current.is_empty() {
        tokens.push(std::mem::take(current));
    }
}

fn trim_trailing_joiner(current: &mut String) {
    while matches!(current.chars().last(), Some('-' | '_')) {
        current.pop();
    }
}

fn can_join(current: &str, next: Option<char>) -> bool {
    !current.is_empty()
        && !matches!(current.chars().last(), Some('-' | '_'))
        && next.is_some_and(char::is_alphanumeric)
}

fn has_event(rows: &[SqliteEventSearchTokenRow], event_id: &str) -> bool {
    rows.iter().any(|row| row.event_id == event_id)
}

const fn is_joiner(ch: char) -> bool {
    ch == '-' || ch == '_'
}

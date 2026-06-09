use lkjstr_protocol::NostrEvent;
use lkjstr_storage::{
    SEARCH_MAX_EVENT_TOKENS, event_search_token_rows, search_candidate_row_limit,
    tokenize_search_query, tokenize_search_text,
};

#[test]
fn search_tokenizer_keeps_joined_terms() {
    assert_eq!(
        tokenize_search_query("  Nostr-WASM nostr_wasm nostr_wasm  "),
        vec!["nostr-wasm", "nostr_wasm"]
    );
}

#[test]
fn event_search_token_rows_keep_positions() {
    let rows = event_search_token_rows(&event("hello hello world"));

    assert_eq!(rows[0].token, "hello");
    assert_eq!(rows[0].position, 0);
    assert_eq!(rows[1].token, "hello");
    assert_eq!(rows[1].position, 1);
    assert_eq!(rows[2].token, "world");
    assert_eq!(rows[2].created_at, 1_700_000_000);
}

#[test]
fn event_search_token_rows_are_bounded() {
    let content = "nostr ".repeat(SEARCH_MAX_EVENT_TOKENS + 10);
    let rows = event_search_token_rows(&event(&content));

    assert_eq!(rows.len(), SEARCH_MAX_EVENT_TOKENS);
}

#[test]
fn search_candidate_limit_is_bounded_without_full_scan() {
    assert_eq!(search_candidate_row_limit(10), 50);
    assert_eq!(search_candidate_row_limit(200), 500);
    assert_eq!(tokenize_search_text("..hello--world__").len(), 2);
}

fn event(content: &str) -> NostrEvent {
    NostrEvent {
        id: "1".repeat(64),
        pubkey: "2".repeat(64),
        created_at: 1_700_000_000,
        kind: 1,
        tags: Vec::new(),
        content: content.to_owned(),
        sig: "3".repeat(128),
    }
}

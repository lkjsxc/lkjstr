#![allow(clippy::expect_used)]
use lkjstr_core::engine::dm::drafts::{self, Catalog, Failed, State};
use serde_json::json;
fn state(text: &str) -> State {
    let mut state = State::default();
    state.draft.text = text.into();
    state
}
fn saved(account: &str) -> String {
    json!({"entries":[{"pubkey":account,"signer":"local","secret":"not-read"}]}).to_string()
}
#[test]
fn absent_empty_and_failed_drafts_round_trip_without_error_details() {
    let mut catalog = Catalog::default();
    assert!(catalog.get("tab").is_none());
    let draft = state("");
    assert!(catalog.apply("tab", Some(draft), None).expect("fixture"));
    let mut draft = state("private marker");
    draft.failed.push(
        serde_json::from_value(json!({
            "key":"failure-1","draft":{"recipients":[],"text":"failed marker"},
            "error":{"code":"rejected","message":"external private detail"}
        }))
        .expect("fixture"),
    );
    let stamp = catalog.stamp("tab").expect("fixture");
    catalog
        .apply("tab", Some(draft), stamp.as_deref())
        .expect("fixture");
    let raw = catalog.encoded().expect("fixture");
    assert!(!raw.contains("external private detail"));
    let loaded = Catalog::from_json(&raw).expect("fixture");
    assert_eq!(
        loaded.get("tab").expect("fixture").draft.text,
        "private marker"
    );
    assert_eq!(
        loaded.get("tab").expect("fixture").failed[0].draft.text,
        "failed marker"
    );
    assert!(format!("{:?}", loaded.get("tab").expect("fixture")).contains("redacted"));
    assert!(!format!("{loaded:?}").contains("private marker"));
}
#[test]
fn conflicting_same_tab_keeps_both_callers_data_and_other_tabs_merge() {
    let mut catalog = Catalog::default();
    catalog
        .apply("a", Some(state("first")), None)
        .expect("fixture");
    let original = catalog.stamp("a").expect("fixture");
    catalog
        .apply("a", Some(state("other writer")), original.as_deref())
        .expect("fixture");
    assert_eq!(
        catalog.apply("a", Some(state("pending local edit")), original.as_deref()),
        Err("rejected")
    );
    assert_eq!(
        catalog.get("a").expect("fixture").draft.text,
        "other writer"
    );
    catalog
        .apply("b", Some(state("independent tab")), None)
        .expect("fixture");
    assert_eq!(
        catalog.get("a").expect("fixture").draft.text,
        "other writer"
    );
    assert_eq!(
        catalog.apply("a", None, original.as_deref()),
        Err("rejected")
    );
    let current = catalog.stamp("a").expect("fixture");
    catalog
        .apply("a", None, current.as_deref())
        .expect("fixture");
    assert!(catalog.get("a").is_none());
}
#[test]
fn bounds_do_not_evict_or_partially_replace_unsaved_content() {
    let mut catalog = Catalog::default();
    for i in 0..drafts::MAX_TABS {
        catalog
            .apply(&format!("tab-{i}"), Some(state("keep")), None)
            .expect("fixture");
    }
    assert_eq!(
        catalog.apply("extra", Some(state("new")), None),
        Err("too-large")
    );
    assert_eq!(catalog.get("tab-0").expect("fixture").draft.text, "keep");
    let previous = catalog.stamp("tab-0").expect("fixture");
    assert_eq!(
        catalog.apply(
            "tab-0",
            Some(state(&"x".repeat(drafts::MAX_STATE))),
            previous.as_deref()
        ),
        Err("too-large")
    );
    assert_eq!(catalog.get("tab-0").expect("fixture").draft.text, "keep");
    let mut full = Catalog::default();
    for i in 0..8 {
        full.apply(
            &format!("large-{i}"),
            Some(state(&"x".repeat(250 * 1024))),
            None,
        )
        .expect("fixture");
    }
    assert_eq!(
        full.apply("overflow", Some(state(&"y".repeat(100 * 1024))), None),
        Err("too-large")
    );
    assert!(full.get("overflow").is_none());
    assert_eq!(
        full.get("large-0").expect("fixture").draft.text.len(),
        250 * 1024
    );
    // A draft beyond Send's 16 KiB ceiling remains recoverable.
    assert!(drafts::validate(&state(&"x".repeat(17 * 1024))).is_ok());
}
#[test]
fn failed_rows_and_identifiers_have_explicit_bounds() {
    let mut draft = state("draft");
    for i in 0..=drafts::MAX_FAILED {
        draft.failed.push(Failed {
            key: format!("failed-{i}"),
            draft: state("failed").draft.clone(),
            error: None,
            dm_delivery: None,
            id: None,
        });
    }
    assert_eq!(drafts::validate(&draft), Err("too-large"));
    draft.failed.pop();
    draft.failed[1].key = draft.failed[0].key.clone();
    assert_eq!(drafts::validate(&draft), Err("rejected"));
    assert_eq!(drafts::tab_key(&"x".repeat(257)), Err("rejected"));
    assert_eq!(drafts::tab_key("bad\nkey"), Err("rejected"));
}
#[test]
fn removed_and_readded_account_cannot_resurrect_an_inflight_first_save() {
    let account = "a".repeat(64);
    let first = "1".repeat(32);
    let after_remove = "2".repeat(32);
    assert!(drafts::saved_account(&saved(&account), &account).is_ok());
    assert_eq!(drafts::compare(&first, Some(&first), None, None), Ok(true));
    assert_eq!(
        drafts::saved_account("{\"entries\":[]}", &account),
        Err("signed-out")
    );
    // Even after the same account is re-added, the pinned generation must not rebase.
    assert!(drafts::saved_account(&saved(&account), &account).is_ok());
    assert_eq!(
        drafts::compare(&first, Some(&after_remove), None, None),
        Err("rejected")
    );
    assert_eq!(
        drafts::compare(&first, Some(&first), Some("old"), Some("new")),
        Ok(false)
    );
}

#[test]
fn removal_plan_deletes_archive_and_rotates_one_bounded_metadata_key() {
    let account = "a".repeat(64);
    let rows = drafts::removal_rows(&account, "b".repeat(32)).expect("fixture");
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0], (format!("dm-drafts-v1:{account}"), None));
    assert_eq!(
        rows[1],
        (drafts::GENERATION_KEY.to_owned(), Some("b".repeat(32)))
    );
}

#[test]
fn loaded_revision_rejects_a_later_stale_editor_and_readded_absence() {
    let account = "a".repeat(64);
    let nonce = "1".repeat(32);
    let mut catalog = Catalog::default();
    let absent = catalog.revision(&account, "tab", &nonce).expect("fixture");
    assert_ne!(
        absent,
        catalog
            .revision(&account, "other-tab", &nonce)
            .expect("fixture")
    );
    assert_ne!(
        absent,
        catalog
            .revision(&"b".repeat(64), "tab", &nonce)
            .expect("fixture")
    );
    catalog
        .check_revision(&account, "tab", &nonce, Some(&absent))
        .expect("fixture");
    catalog
        .apply("tab", Some(state("loaded X")), None)
        .expect("fixture");
    let x = catalog.revision(&account, "tab", &nonce).expect("fixture");
    catalog
        .apply("other-tab", Some(state("independent edit")), None)
        .expect("fixture");
    assert_eq!(
        catalog
            .check_revision(&account, "tab", &nonce, Some(&x))
            .expect("fixture"),
        x
    );
    let stamp = catalog.stamp("tab").expect("fixture");
    catalog
        .apply(
            "tab",
            Some(state("separately committed Y")),
            stamp.as_deref(),
        )
        .expect("fixture");
    assert_eq!(
        catalog.check_revision(&account, "tab", &nonce, Some(&x)),
        Err("rejected")
    );
    assert_eq!(
        catalog.get("tab").expect("fixture").draft.text,
        "separately committed Y"
    );
    assert!(
        catalog
            .check_revision(&account, "tab", &nonce, None)
            .is_ok()
    );
    let empty = Catalog::default();
    assert_eq!(
        empty.check_revision(&account, "tab", &"2".repeat(32), Some(&absent)),
        Err("rejected")
    );
}

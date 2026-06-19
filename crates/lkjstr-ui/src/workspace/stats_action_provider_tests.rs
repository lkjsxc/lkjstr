use std::sync::{
    Arc,
    atomic::{AtomicU8, Ordering},
};

use leptos::prelude::Callback;

use super::*;

#[test]
fn unavailable_actions_do_not_expose_buttons() {
    let actions = StatsActions::unavailable("host-missing");
    assert!(!actions.can_compact());
    assert!(!actions.can_repair());
    assert!(!actions.has_any_action());
    assert_eq!(
        actions.unavailable_text(),
        "Storage actions unavailable: host-missing"
    );
}

#[test]
fn available_actions_run_through_typed_command() {
    const COMPACT_SEEN: u8 = 1;
    const REPAIR_SEEN: u8 = 2;
    let seen = Arc::new(AtomicU8::new(0));
    let seen_run = Arc::clone(&seen);
    let actions = StatsActions::new(
        move |command| match command {
            StatsActionCommand::Compact(complete) => {
                seen_run.fetch_or(COMPACT_SEEN, Ordering::SeqCst);
                complete.complete(StatsActionResult::new(
                    StatsActionKind::Compact,
                    "Compaction planned",
                ));
            }
            StatsActionCommand::Repair(complete) => {
                seen_run.fetch_or(REPAIR_SEEN, Ordering::SeqCst);
                complete.complete(StatsActionResult::new(
                    StatsActionKind::Repair,
                    "Repair planned",
                ));
            }
        },
        true,
        false,
    );
    assert!(actions.can_compact());
    assert!(!actions.can_repair());
    actions.compact(Callback::new(|result: StatsActionResult| {
        assert_eq!(result.kind, StatsActionKind::Compact);
        assert_eq!(result.status, "Compaction planned");
    }));
    assert_eq!(seen.load(Ordering::SeqCst), COMPACT_SEEN);
    actions.repair(Callback::new(|result: StatsActionResult| {
        assert_eq!(result.kind, StatsActionKind::Repair);
        assert_eq!(
            result.status,
            "Storage action unavailable: action-not-provided"
        );
    }));
    assert_eq!(seen.load(Ordering::SeqCst), COMPACT_SEEN);
}

#[test]
fn disabled_actions_return_kind_specific_reason() {
    let called = Arc::new(AtomicU8::new(0));
    let called_run = Arc::clone(&called);
    let actions = StatsActions::new_with_unavailable_reasons(
        move |_command| {
            called_run.fetch_add(1, Ordering::SeqCst);
        },
        false,
        true,
        "compaction-adapter-missing",
        "action-not-provided",
    );
    assert!(!actions.can_compact());
    assert!(actions.can_repair());
    actions.compact(Callback::new(|result: StatsActionResult| {
        assert_eq!(result.kind, StatsActionKind::Compact);
        assert_eq!(
            result.status,
            "Storage action unavailable: compaction-adapter-missing"
        );
    }));
    assert_eq!(called.load(Ordering::SeqCst), 0);
}

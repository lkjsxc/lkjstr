#![allow(clippy::expect_used)]
use lkjstr_core::engine::dm::editors::{Editors, MAX_EDITORS, MAX_PER_CLIENT, PREPARE_MS};
fn account() -> String {
    "11".repeat(32)
}
fn editor(e: &mut Editors, client: u64, name: &str) {
    e.register(client, &account(), name, None)
        .expect("valid test fixture");
}
#[test]
fn all_pages_flush_before_commit_and_hold_until_release() {
    let mut e = Editors::default();
    editor(&mut e, 1, "one");
    editor(&mut e, 1, "two");
    editor(&mut e, 2, "three");
    let t = e
        .begin(&account(), 100, "worker-one")
        .expect("valid test fixture");
    assert_eq!(t.clients.len(), 2);
    e.answer(1, &t.req, true);
    assert_eq!(e.decision(&t.req, 101), None);
    e.answer(2, &t.req, true);
    assert_eq!(e.decision(&t.req, 102), Some(true));
    assert_eq!(e.register(3, &account(), "late", None), Err("internal"));
    assert_eq!(e.finish(&t.req), Some(t.clone()));
    editor(&mut e, 3, "late");
}
#[test]
fn refused_missing_or_timed_out_page_never_locks() {
    for reason in 0..3 {
        let mut e = Editors::default();
        editor(&mut e, 1, "one");
        let t = e
            .begin(&account(), 100, "worker-one")
            .expect("valid test fixture");
        match reason {
            0 => e.answer(1, &t.req, false),
            1 => e.detach(1),
            _ => {}
        }
        assert_eq!(e.decision(&t.req, 100 + PREPARE_MS), Some(false));
        e.finish(&t.req);
        editor(&mut e, 1, "one");
    }
}
#[test]
fn reply_owner_and_attempt_identity_reject_stale_or_duplicate_answers() {
    let mut e = Editors::default();
    editor(&mut e, 1, "one");
    let old = e
        .begin(&account(), 0, "worker-one")
        .expect("valid test fixture");
    e.finish(&old.req);
    let t = e
        .begin(&account(), 1, "worker-one")
        .expect("valid test fixture");
    e.answer(1, &old.req, true);
    e.answer(2, &t.req, true);
    assert_eq!(e.decision(&t.req, 2), None);
    e.answer(1, &t.req, false);
    e.answer(1, &t.req, true);
    assert_eq!(e.decision(&t.req, 3), Some(false));
    assert!(e.finish(&old.req).is_none());
    assert_eq!(e.finish(&t.req), Some(t));
}
#[test]
fn no_editors_still_reserves_account_against_registration_during_commit() {
    let mut e = Editors::default();
    let t = e
        .begin(&account(), 0, "worker-one")
        .expect("valid test fixture");
    assert!(t.clients.is_empty());
    assert_eq!(e.decision(&t.req, 1), Some(true));
    assert_eq!(e.register(1, &account(), "late", None), Err("internal"));
    assert!(e.register(1, &"22".repeat(32), "other", None).is_ok());
    e.finish(&t.req);
    editor(&mut e, 1, "late");
}
#[test]
fn close_expiry_and_authority_revocation_fail_pending_prepare() {
    for reason in 0..3 {
        let mut e = Editors::default();
        editor(&mut e, 1, "one");
        let t = e
            .begin(&account(), 0, "worker-one")
            .expect("valid test fixture");
        match reason {
            0 => e.unregister(1, &account(), "one"),
            1 => e.retain(&[account()].into_iter().collect(), &Default::default()),
            _ => e.retain(&Default::default(), &[1].into_iter().collect()),
        }
        assert_eq!(e.decision(&t.req, 1), Some(false));
    }
}
#[test]
fn closing_a_saved_page_after_commit_authorization_does_not_undo_its_flush() {
    let mut e = Editors::default();
    editor(&mut e, 1, "one");
    let t = e
        .begin(&account(), 0, "worker-one")
        .expect("valid test fixture");
    e.answer(1, &t.req, true);
    assert_eq!(e.decision(&t.req, 1), Some(true));
    e.detach(1);
    assert_eq!(e.decision(&t.req, PREPARE_MS + 1), Some(true));
}
#[test]
fn editor_identity_and_bounds_have_explicit_release() {
    let mut e = Editors::default();
    for client in 0..4 {
        for n in 0..MAX_PER_CLIENT {
            editor(&mut e, client, &format!("e-{client}-{n}"));
        }
    }
    assert_eq!(MAX_EDITORS, 4 * MAX_PER_CLIENT);
    assert_eq!(
        e.register(8, &account(), "overflow", None),
        Err("too-large")
    );
    e.detach(1);
    editor(&mut e, 8, "reused");
    assert_eq!(
        e.register(8, &"22".repeat(32), "reused", None),
        Err("rejected")
    );
    assert_eq!(e.register(9, &account(), "", None), Err("rejected"));
    assert_eq!(e.register(9, "bad", "valid", None), Err("rejected"));
    assert_eq!(e.register(0, &account(), "extra", None), Err("too-large"));
}

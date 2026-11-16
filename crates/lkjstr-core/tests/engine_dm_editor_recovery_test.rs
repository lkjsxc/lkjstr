#![allow(clippy::expect_used)]
use lkjstr_core::engine::dm::editors::Editors;
fn a() -> String {
    "11".repeat(32)
}
fn b() -> String {
    "22".repeat(32)
}
#[test]
fn closing_or_revoking_another_account_cannot_fail_this_accounts_prepare() {
    for revoke in [false, true] {
        let mut e = Editors::default();
        e.register(1, &a(), "one", None)
            .expect("valid test fixture");
        e.register(1, &b(), "two", None)
            .expect("valid test fixture");
        let t = e.begin(&a(), 0, "worker-one").expect("valid test fixture");
        if revoke {
            e.retain(&[a()].into_iter().collect(), &[1].into_iter().collect());
        } else {
            e.unregister(1, &b(), "two");
        }
        e.answer(1, &t.req, true);
        assert_eq!(e.decision(&t.req, 1), Some(true));
    }
}
#[test]
fn frozen_dirty_editor_blocks_later_lock_until_same_store_resumes() {
    let mut e = Editors::default();
    e.register(1, &a(), "stable-uuid", Some(true))
        .expect("valid test fixture");
    e.expire(1);
    e.detach(1); // expiry removes port but must retain the unresolved draft lease
    let t = e
        .begin(&a(), 180001, "worker-one")
        .expect("valid test fixture");
    assert_eq!(e.decision(&t.req, 180002), Some(false));
    e.finish(&t.req);
    e.register(2, &a(), "stable-uuid", Some(true))
        .expect("valid test fixture");
    let t = e
        .begin(&a(), 180003, "worker-one")
        .expect("valid test fixture");
    assert_eq!(t.clients, [2].into_iter().collect());
    e.answer(1, &t.req, true);
    assert_eq!(e.decision(&t.req, 180004), None);
    e.register(2, &a(), "stable-uuid", Some(false))
        .expect("valid test fixture");
    e.answer(2, &t.req, true);
    assert_eq!(e.decision(&t.req, 180005), Some(true));
}
#[test]
fn frozen_clean_editor_is_uncertain_until_it_can_confirm_its_latest_state() {
    let mut e = Editors::default();
    e.register(1, &a(), "frozen", Some(false))
        .expect("valid test fixture");
    e.register(2, &a(), "live", Some(false))
        .expect("valid test fixture");
    // The first dirty frame can still be queued when this client's timer expires.
    e.expire(1);
    let t = e
        .begin(&a(), 180001, "worker-one")
        .expect("valid test fixture");
    e.answer(2, &t.req, true);
    assert_eq!(e.decision(&t.req, 180002), Some(false));
    e.finish(&t.req);
    e.register(3, &a(), "frozen", Some(true))
        .expect("valid test fixture");
    let next = e
        .begin(&a(), 180003, "worker-one")
        .expect("valid test fixture");
    e.answer(2, &next.req, true);
    assert_eq!(e.decision(&next.req, 180004), None);
    e.register(3, &a(), "frozen", Some(false))
        .expect("valid test fixture");
    e.answer(3, &next.req, true);
    assert_eq!(e.decision(&next.req, 180005), Some(true));
}
#[test]
fn a_stale_success_cannot_certify_an_editor_still_marked_dirty() {
    let mut e = Editors::default();
    e.register(1, &a(), "dirty", Some(true))
        .expect("valid test fixture");
    let t = e.begin(&a(), 0, "worker-one").expect("valid test fixture");
    e.answer(1, &t.req, true);
    assert_eq!(e.decision(&t.req, 1), Some(false));
}
#[test]
fn worker_namespaces_cannot_reuse_flush_request_identity() {
    let mut old = Editors::default();
    let mut next = Editors::default();
    old.register(1, &a(), "same-editor", None)
        .expect("valid test fixture");
    next.register(1, &a(), "same-editor", None)
        .expect("valid test fixture");
    let first = old
        .begin(&a(), 0, "worker-one")
        .expect("valid test fixture");
    let replacement = next
        .begin(&a(), 1, "worker-two")
        .expect("valid test fixture");
    assert_ne!(first.req, replacement.req);
    next.answer(1, &first.req, true);
    assert_eq!(next.decision(&replacement.req, 2), None);
}

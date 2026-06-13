use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::default_user_timeline_feed_view;
use lkjstr_ui::{UserTimelineProvider, UserTimelineRequest};

#[test]
fn user_timeline_provider_forwards_target_pubkey() {
    let captured = Arc::new(Mutex::new(None::<Option<String>>));
    let captured_for_provider = captured.clone();
    let provider = UserTimelineProvider::new(move |request| {
        replace_slot(&captured_for_provider, request.target_pubkey.clone());
    });

    let lease = provider.read(
        "tab-a".to_owned(),
        Some("a".repeat(64)),
        Callback::new(|_| {}),
    );

    assert_eq!(slot_snapshot(&captured), Some(Some("a".repeat(64))));
    lease.release();
}

#[test]
fn user_timeline_lease_runs_release_cleanup_once() {
    let request = Arc::new(Mutex::new(None));
    let request_capture = request.clone();
    let provider = UserTimelineProvider::new(move |next| {
        replace_slot(&request_capture, next);
    });
    let lease = provider.read("tab-a".to_owned(), None, Callback::new(|_| {}));
    let calls = Arc::new(AtomicUsize::new(0));
    if let Some(request) = request_snapshot(&request).as_ref() {
        request.lease().on_release({
            let calls = calls.clone();
            move || {
                calls.fetch_add(1, Ordering::SeqCst);
            }
        });
    }

    lease.release();
    lease.release();

    assert!(request_snapshot(&request).is_some(), "request captured");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[test]
fn released_user_timeline_request_suppresses_late_completion() {
    let request = Arc::new(Mutex::new(None));
    let request_capture = request.clone();
    let provider = UserTimelineProvider::new(move |next| {
        replace_slot(&request_capture, next);
    });
    let completed = Arc::new(AtomicBool::new(false));
    let completed_capture = completed.clone();
    let lease = provider.read(
        "tab-a".to_owned(),
        Some("a".repeat(64)),
        Callback::new(move |_| completed_capture.store(true, Ordering::SeqCst)),
    );

    lease.release();
    let captured = request_snapshot(&request);
    if let Some(request) = captured.as_ref() {
        request.complete(default_user_timeline_feed_view(
            "tab-a",
            Some("a".repeat(64)),
        ));
    }

    assert!(captured.is_some(), "request captured");
    assert!(!completed.load(Ordering::SeqCst));
}

fn replace_slot<T: Clone>(slot: &Arc<Mutex<Option<T>>>, value: T) {
    match slot.lock() {
        Ok(mut slot) => {
            slot.replace(value);
        }
        Err(poisoned) => {
            poisoned.into_inner().replace(value);
        }
    }
}

fn slot_snapshot<T: Clone>(slot: &Arc<Mutex<Option<T>>>) -> Option<T> {
    match slot.lock() {
        Ok(slot) => slot.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

fn request_snapshot(slot: &Arc<Mutex<Option<UserTimelineRequest>>>) -> Option<UserTimelineRequest> {
    slot_snapshot(slot)
}

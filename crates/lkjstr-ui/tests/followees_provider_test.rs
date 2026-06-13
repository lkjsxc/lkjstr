use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::default_followees_view;
use lkjstr_ui::{FolloweesProvider, FolloweesRequest};

#[test]
fn followees_lease_runs_release_cleanup_once() {
    let calls = Arc::new(AtomicUsize::new(0));
    let calls_capture = calls.clone();
    let provider = FolloweesProvider::new(move |request| {
        let calls_capture = calls_capture.clone();
        request.lease().on_release(move || {
            calls_capture.fetch_add(1, Ordering::SeqCst);
        });
    });

    let lease = provider.read("tab-a".to_owned(), Some(pubkey()), Callback::new(|_| {}));
    lease.release();
    lease.release();

    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[test]
fn released_followees_request_suppresses_late_completion() {
    let request = Arc::new(Mutex::new(None::<FolloweesRequest>));
    let request_capture = request.clone();
    let provider = FolloweesProvider::new(move |next| replace_slot(&request_capture, next));
    let completed = Arc::new(AtomicBool::new(false));
    let completed_capture = completed.clone();
    let lease = provider.read(
        "tab-a".to_owned(),
        Some(pubkey()),
        Callback::new(move |_| completed_capture.store(true, Ordering::SeqCst)),
    );

    lease.release();
    let captured = request_snapshot(&request);
    if let Some(request) = captured.as_ref() {
        request.complete(default_followees_view("tab-a", Some(pubkey())));
    }

    assert!(captured.is_some(), "request captured");
    assert!(!completed.load(Ordering::SeqCst));
}

#[test]
fn followees_provider_forwards_target_pubkey() -> Result<(), String> {
    let request = Arc::new(Mutex::new(None::<FolloweesRequest>));
    let request_capture = request.clone();
    let provider = FolloweesProvider::new(move |next| replace_slot(&request_capture, next));

    let lease = provider.read("tab-a".to_owned(), Some(pubkey()), Callback::new(|_| {}));
    let Some(captured) = request_snapshot(&request) else {
        return Err("request captured".to_owned());
    };

    assert_eq!(captured.owner, "tab-a");
    assert_eq!(captured.target_pubkey, Some(pubkey()));
    lease.release();
    Ok(())
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

fn request_snapshot(slot: &Arc<Mutex<Option<FolloweesRequest>>>) -> Option<FolloweesRequest> {
    match slot.lock() {
        Ok(slot) => slot.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

fn pubkey() -> String {
    "a".repeat(64)
}

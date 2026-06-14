use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::unavailable_custom_request_feed_view;
use lkjstr_ui::{CustomRequestProvider, CustomRequestRunRequest as UiRunRequest};

#[test]
fn custom_request_lease_runs_release_cleanup_once() {
    let calls = Arc::new(AtomicUsize::new(0));
    let calls_capture = calls.clone();
    let provider = CustomRequestProvider::new(move |request| {
        let calls_capture = calls_capture.clone();
        request.lease().on_release(move || {
            calls_capture.fetch_add(1, Ordering::SeqCst);
        });
    });

    let lease = provider.run("tab-a".to_owned(), "{}".to_owned(), Callback::new(|_| {}));
    lease.release();
    lease.release();

    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[test]
fn released_custom_request_suppresses_late_completion() {
    let request = Arc::new(Mutex::new(None::<UiRunRequest>));
    let request_capture = request.clone();
    let provider = CustomRequestProvider::new(move |next| replace_slot(&request_capture, next));
    let completed = Arc::new(AtomicBool::new(false));
    let completed_capture = completed.clone();
    let lease = provider.run(
        "tab-a".to_owned(),
        "{}".to_owned(),
        Callback::new(move |_| completed_capture.store(true, Ordering::SeqCst)),
    );

    lease.release();
    let captured = request_snapshot(&request);
    if let Some(request) = captured.as_ref() {
        request.complete(unavailable_custom_request_feed_view(
            "tab-a",
            "late completion",
            false,
        ));
    }

    assert!(captured.is_some(), "request captured");
    assert!(!completed.load(Ordering::SeqCst));
}

#[test]
fn custom_request_provider_forwards_raw_json() -> Result<(), String> {
    let request = Arc::new(Mutex::new(None::<UiRunRequest>));
    let request_capture = request.clone();
    let provider = CustomRequestProvider::new(move |next| replace_slot(&request_capture, next));

    let lease = provider.run(
        "tab-a".to_owned(),
        r#"{"kinds":[1]}"#.to_owned(),
        Callback::new(|_| {}),
    );
    let Some(captured) = request_snapshot(&request) else {
        return Err("request captured".to_owned());
    };

    assert_eq!(captured.owner, "tab-a");
    assert_eq!(captured.raw_json, r#"{"kinds":[1]}"#);
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

fn request_snapshot(slot: &Arc<Mutex<Option<UiRunRequest>>>) -> Option<UiRunRequest> {
    match slot.lock() {
        Ok(slot) => slot.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

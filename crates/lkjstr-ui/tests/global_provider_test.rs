use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::{GlobalOlderLoadTrigger, default_global_feed_view};
use lkjstr_ui::{GlobalFeedProvider, GlobalFeedRequest, GlobalOlderRequest};

#[test]
fn global_feed_lease_runs_release_cleanup_once() {
    let calls = Arc::new(AtomicUsize::new(0));
    let calls_capture = calls.clone();
    let provider = GlobalFeedProvider::new(move |request| {
        let calls_capture = calls_capture.clone();
        request.lease().on_release(move || {
            calls_capture.fetch_add(1, Ordering::SeqCst);
        });
    });

    let lease = provider.read("tab-a".to_owned(), Callback::new(|_| {}));
    lease.release();
    lease.release();

    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[test]
fn released_global_feed_request_suppresses_late_completion() {
    let request = Arc::new(Mutex::new(None::<GlobalFeedRequest>));
    let request_capture = request.clone();
    let provider = GlobalFeedProvider::new(move |next| replace_slot(&request_capture, next));
    let completed = Arc::new(AtomicBool::new(false));
    let completed_capture = completed.clone();
    let lease = provider.read(
        "tab-a".to_owned(),
        Callback::new(move |_| completed_capture.store(true, Ordering::SeqCst)),
    );

    lease.release();
    let captured = request_snapshot(&request);
    if let Some(request) = captured.as_ref() {
        request.complete(default_global_feed_view("tab-a"));
    }

    assert!(captured.is_some(), "request captured");
    assert!(!completed.load(Ordering::SeqCst));
}

#[test]
fn global_provider_forwards_older_request_trigger() -> Result<(), String> {
    let request = Arc::new(Mutex::new(None::<GlobalOlderRequest>));
    let request_capture = request.clone();
    let provider = GlobalFeedProvider::with_older(
        |_| {},
        move |next| {
            replace_slot(&request_capture, next);
        },
    );

    let lease = provider.load_older(
        "tab-a".to_owned(),
        GlobalOlderLoadTrigger::Explicit,
        true,
        true,
        Callback::new(|_| {}),
    );

    let Some(captured) = older_snapshot(&request) else {
        return Err("older request captured".to_owned());
    };
    assert_eq!(captured.owner, "tab-a");
    assert_eq!(captured.trigger, GlobalOlderLoadTrigger::Explicit);
    assert!(captured.scrollable);
    assert!(captured.user_scrolled_down);
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

fn request_snapshot(slot: &Arc<Mutex<Option<GlobalFeedRequest>>>) -> Option<GlobalFeedRequest> {
    match slot.lock() {
        Ok(slot) => slot.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

fn older_snapshot(slot: &Arc<Mutex<Option<GlobalOlderRequest>>>) -> Option<GlobalOlderRequest> {
    match slot.lock() {
        Ok(slot) => slot.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

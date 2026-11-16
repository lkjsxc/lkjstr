use lkjstr_core::engine::upload_jobs::Jobs;
type TestResult = Result<(), Box<dyn std::error::Error>>;
#[test]
fn cancellation_is_owned_and_has_one_terminal_claim() -> TestResult {
    let mut jobs = Jobs::default();
    let first = jobs.begin(1, "r1")?;
    let other = jobs.begin(2, "r1")?;
    assert!(jobs.cancel(3, "r1").is_none());
    assert_eq!(jobs.cancel(1, "r1"), Some(first.clone()));
    assert!(jobs.cancel(1, "r1").is_none());
    assert!(!jobs.current(&first));
    assert!(!jobs.finish(&first));
    assert!(jobs.current(&other));
    assert!(jobs.finish(&other));
    assert!(!jobs.finish(&other));
    Ok(())
}
#[test]
fn a_cancelled_generation_cannot_consume_new_work_with_the_same_request() -> TestResult {
    let mut jobs = Jobs::default();
    let old = jobs.begin(1, "r1")?;
    assert!(jobs.begin(1, "r1").is_err());
    assert!(jobs.cancel(1, "r1").is_some());
    let new = jobs.begin(1, "r1")?;
    assert_ne!(old, new);
    assert!(!jobs.finish(&old));
    assert!(jobs.current(&new));
    assert!(jobs.finish(&new));
    assert!(jobs.cancel(1, "r1").is_none());
    Ok(())
}
#[test]
fn cancelling_releases_capacity_without_retaining_tombstones() -> TestResult {
    let mut jobs = Jobs::default();
    for i in 0..4 {
        jobs.begin(i, "r")?;
    }
    assert_eq!(jobs.begin(9, "full"), Err("too-large"));
    assert!(jobs.cancel(0, "r").is_some());
    let next = jobs.begin(9, "next")?;
    assert_eq!(jobs.leases().len(), 4);
    jobs.finish(&next);
    for i in 0..1000 {
        let lease = jobs.begin(10, &i.to_string())?;
        jobs.finish(&lease);
    }
    assert_eq!(jobs.leases().len(), 3);
    Ok(())
}
#[test]
fn cancellation_acknowledgement_is_explicit_and_never_a_success() -> TestResult {
    let result = lkjstr_core::engine::wire::Session::cancelled("original".into());
    assert_eq!(
        serde_json::to_value(result)?,
        serde_json::json!({
            "t": "result", "req": "original", "ok": false, "cancelled": true
        })
    );
    Ok(())
}

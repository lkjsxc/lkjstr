#![allow(clippy::expect_used, clippy::panic)]
use super::*;
use crate::engine::protocol::{Input, Query, Source};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};

fn id(n: usize) -> String {
    format!("{n:064x}")
}
fn open(engine: &mut Engine, owner: &str, target: &str, now: u64) {
    engine.input(
        Input::Open {
            sub: owner.into(),
            query: Query {
                source: Source::Thread,
                target: Some(target.into()),
                ..Default::default()
            },
        },
        now,
    );
}
fn signed(kind: u64, content: &str) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content: content.into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("signed local fixture")
}
#[test]
fn local_reads_are_disabled_until_the_host_explicitly_opts_in() {
    let mut engine = Engine::new();
    open(&mut engine, "a", &id(1), 0);
    assert!(engine.drain_local_reads(0).is_empty());
    let mut enabled = Engine::new();
    enabled.set_local_reads_enabled(true, 0);
    open(&mut enabled, "a", &id(1), 0);
    let jobs = enabled.drain_local_reads(0);
    assert_eq!(jobs.len(), 1);
    assert_eq!(jobs[0].ids, [id(1)]);
    assert_eq!(jobs[0].deadline, DEADLINE_MS);
    assert_eq!(jobs[0].max_bytes, RESULT_BYTES);
}
#[test]
fn multiple_views_coalesce_and_the_final_owner_releases_the_job() {
    let mut engine = Engine::new();
    engine.set_local_reads_enabled(true, 0);
    let focus = id(2);
    open(&mut engine, "left", &focus, 0);
    open(&mut engine, "right", &focus, 0);
    let jobs = engine.drain_local_reads(1);
    assert_eq!(jobs.len(), 1);
    assert_eq!(jobs[0].ids, [focus]);
    engine.input(Input::Close { sub: "left".into() }, 2);
    assert!(engine.local_read_live(jobs[0].job, 2));
    engine.input(
        Input::Close {
            sub: "right".into(),
        },
        3,
    );
    assert!(!engine.local_read_live(jobs[0].job, 3));
    assert!(!engine.finish_local_read(jobs[0].job, Err(LocalReadFailure::Cancelled), 3));
}
#[test]
fn verified_disk_body_is_admitted_before_a_second_network_read() {
    let event = signed(1, "verified");
    let mut engine = Engine::new();
    engine.set_local_reads_enabled(true, 0);
    open(&mut engine, "thread", &event.id, 0);
    let job = engine.drain_local_reads(0).pop().expect("disk job");
    let record = Record::verified(&event).expect("verified record");
    assert!(engine.finish_local_read(
        job.job,
        Ok(LocalReadResult {
            completed: vec![event.id.clone()],
            records: vec![record],
        }),
        10
    ));
    assert!(engine.store.get(&event.id).is_some());
    assert!(engine.drain_local_reads(11).is_empty());
}
#[test]
fn partial_disk_result_retries_only_its_unfinished_suffix() {
    let event = signed(1, "present");
    let missing = id(3);
    let mut engine = Engine::new();
    engine.set_local_reads_enabled(true, 0);
    open(&mut engine, "one", &event.id, 0);
    open(&mut engine, "two", &missing, 0);
    let job = engine.drain_local_reads(0).pop().expect("shared batch");
    assert_eq!(job.ids.len(), 2);
    assert!(engine.finish_local_read(
        job.job,
        Ok(LocalReadResult {
            completed: vec![event.id.clone()],
            records: vec![Record::verified(&event).expect("receipt")],
        }),
        10
    ));
    assert!(engine.store.get(&event.id).is_some());
    assert!(engine.drain_local_reads(34).is_empty());
    let next = engine.drain_local_reads(35);
    assert_eq!(next.len(), 1);
    assert_eq!(next[0].ids, [missing]);
}
#[test]
fn failed_disk_job_releases_network_fallback_without_a_false_empty_result() {
    let mut engine = Engine::new();
    engine.set_local_reads_enabled(true, 0);
    let target = id(4);
    open(&mut engine, "thread", &target, 0);
    let job = engine.drain_local_reads(0).pop().expect("job");
    assert!(engine.finish_local_read(job.job, Err(LocalReadFailure::Unavailable), 1));
    assert!(!engine.local_reads.pending(&target, 1));
    assert!(
        engine.drain_local_reads(100).is_empty(),
        "negative-evidence cooldown"
    );
}
#[test]
fn malformed_rows_and_disallowed_private_kinds_are_not_admitted() {
    for event in [signed(1, "incorrect claimed id"), signed(4, "private")] {
        let mut engine = Engine::new();
        engine.set_local_reads_enabled(true, 0);
        open(&mut engine, "thread", &event.id, 0);
        let job = engine.drain_local_reads(0).pop().expect("job");
        let mut record = Record::verified(&event).expect("record");
        if event.kind == 1 {
            record.id = id(999);
        }
        assert!(engine.finish_local_read(
            job.job,
            Ok(LocalReadResult {
                completed: vec![event.id.clone()],
                records: vec![record],
            }),
            1
        ));
        assert!(engine.store.get(&event.id).is_none());
    }
}
#[test]
fn completed_result_over_byte_cap_does_not_insert_or_stall() {
    let event = signed(1, "overlarge");
    let mut engine = Engine::new();
    engine.set_local_reads_enabled(true, 0);
    open(&mut engine, "thread", &event.id, 0);
    let job = engine.drain_local_reads(0).pop().expect("job");
    let mut record = Record::verified(&event).expect("record");
    record.raw = "x".repeat(RESULT_BYTES + 1);
    assert!(engine.finish_local_read(
        job.job,
        Ok(LocalReadResult {
            completed: vec![event.id.clone()],
            records: vec![record],
        }),
        1
    ));
    assert!(engine.store.get(&event.id).is_none());
    assert!(!engine.local_reads.pending(&event.id, 1));
}
#[test]
fn a_previous_enable_generation_cannot_complete_after_disable() {
    let mut engine = Engine::new();
    engine.set_local_reads_enabled(true, 0);
    open(&mut engine, "thread", &id(5), 0);
    let job = engine.drain_local_reads(0).pop().expect("job");
    engine.set_local_reads_enabled(false, 1);
    assert!(!engine.local_read_live(job.job, 1));
    assert!(!engine.finish_local_read(job.job, Ok(LocalReadResult::default()), 1));
}

use lkjstr_storage::{
    CacheResourceKind, RepairFindingKind, RepairTargetProbe, RepairTargetProbeInput,
    RepairTargetState, finish_repair_target_probe, repair_probe_row, repair_probe_statement_id,
    repair_target_probe_batch,
};

#[test]
fn repair_probe_routes_known_targets_to_approved_statement() {
    let target = target(CacheResourceKind::NostrEvent, "events", "event-1");

    assert_eq!(
        repair_probe_statement_id(&target),
        Some("events.repair_probe")
    );
}

#[test]
fn repair_probe_keeps_mismatched_targets_unknown() {
    let target = target(CacheResourceKind::NostrEvent, "mystery", "event-1");
    let row = repair_probe_row(&target, RepairTargetState::Unavailable, true, false);
    let output = finish_repair_target_probe(input(vec![target]), vec![row]);
    let kinds: Vec<_> = output.findings.iter().map(|finding| finding.kind).collect();

    assert!(kinds.contains(&RepairFindingKind::UnknownUnownedRow));
    assert!(kinds.contains(&RepairFindingKind::SkippedUnknownRow));
    assert_eq!(output.rows[0].target_state, RepairTargetState::Unavailable);
}

#[test]
fn repair_probe_reports_chunk_continuation() {
    let input = RepairTargetProbeInput {
        limit: 1,
        targets: vec![
            target(CacheResourceKind::NostrEvent, "events", "event-1"),
            target(CacheResourceKind::JobRecord, "jobs", "job-1"),
        ],
        ..input(Vec::new())
    };
    let batch = repair_target_probe_batch(&input);
    let row = repair_probe_row(&batch.targets[0], RepairTargetState::Present, true, false);
    let output = finish_repair_target_probe(input, vec![row]);

    assert_eq!(output.scanned_count, 1);
    assert_eq!(output.next_cursor.as_deref(), Some("event-1"));
    assert!(output.chunk_continues);
    assert!(
        output
            .findings
            .iter()
            .any(|finding| finding.kind == RepairFindingKind::ChunkContinuation)
    );
}

fn input(targets: Vec<RepairTargetProbe>) -> RepairTargetProbeInput {
    RepairTargetProbeInput {
        targets,
        after_resource_id: None,
        limit: 10,
        inventory_complete: true,
        temporary_memory_mode: false,
        schema_matches: true,
    }
}

fn target(kind: CacheResourceKind, table_name: &str, resource_id: &str) -> RepairTargetProbe {
    RepairTargetProbe {
        resource_kind: kind,
        table_name: table_name.to_owned(),
        resource_id: resource_id.to_owned(),
        ledger_state: RepairTargetState::Present,
        protected: false,
    }
}

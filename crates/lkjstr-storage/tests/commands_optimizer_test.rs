use lkjstr_storage::{
    StorageCommandFamily, StorageLedgerPolicy, StorageOperation, StorageProblemKind,
    StorageProtectionPolicy, StorageStatsProjection, storage_repository_commands,
};

#[test]
fn commands_optimizer_specs_are_present() -> Result<(), String> {
    for id in [
        "optimizer.feed-scan-observation.insert",
        "optimizer.feed-scan-density-model.select-context",
        "optimizer.feed-scan-density-model.upsert",
        "optimizer.feed-scan-decision-trace.insert",
        "optimizer.feed-row-height-observation.insert",
        "optimizer.feed-row-height-observation.prune-before",
        "optimizer.feed-row-height-model.select",
        "optimizer.feed-row-height-model.upsert",
    ] {
        let command = command(id)?;
        assert_eq!(command.family, StorageCommandFamily::Optimizer);
        assert_eq!(command.ledger_policy, StorageLedgerPolicy::None);
        assert_eq!(command.stats_projection, StorageStatsProjection::Optimizer);
        assert_eq!(
            command.protection_policy,
            StorageProtectionPolicy::RecoverableDiagnostics
        );
    }
    Ok(())
}

#[test]
fn commands_optimizer_reads_and_writes_have_stable_shapes() -> Result<(), String> {
    let observation = command("optimizer.feed-scan-observation.insert")?;
    assert_optimizer_write(
        observation,
        &["feed_scan_observations.insert"],
        &["feed_scan_observations"],
        &["sqlite_scan_observation_row"],
    );

    let select = command("optimizer.feed-scan-density-model.select-context")?;
    assert_eq!(select.operation, StorageOperation::Read);
    assert_eq!(
        select.statements,
        &["feed_scan_density_models.select_context"]
    );
    assert_eq!(select.tables, &["feed_scan_density_models"]);
    assert_eq!(select.row_codecs, &["scan_density_model_from_sqlite_row"]);
    assert_eq!(
        select.problem_kinds,
        &[StorageProblemKind::OptimizerRecordDecodeFailed]
    );

    let upsert = command("optimizer.feed-scan-density-model.upsert")?;
    assert_optimizer_write(
        upsert,
        &["feed_scan_density_models.upsert"],
        &["feed_scan_density_models"],
        &["sqlite_scan_density_model_row"],
    );

    let trace = command("optimizer.feed-scan-decision-trace.insert")?;
    assert_optimizer_write(
        trace,
        &["feed_scan_decision_traces.insert"],
        &["feed_scan_decision_traces"],
        &["sqlite_scan_decision_trace_row"],
    );

    let observation = command("optimizer.feed-row-height-observation.insert")?;
    assert_optimizer_write(
        observation,
        &["feed_row_height_observations.insert"],
        &["feed_row_height_observations"],
        &["sqlite_feed_row_height_observation_row"],
    );

    let prune = command("optimizer.feed-row-height-observation.prune-before")?;
    assert_optimizer_write(
        prune,
        &["feed_row_height_observations.delete_before"],
        &["feed_row_height_observations"],
        &["sqlite_feed_row_height_observation_row"],
    );

    let model = command("optimizer.feed-row-height-model.select")?;
    assert_eq!(model.operation, StorageOperation::Read);
    assert_eq!(model.statements, &["feed_row_height_models.select"]);
    assert_eq!(model.tables, &["feed_row_height_models"]);
    assert_eq!(model.row_codecs, &["feed_row_height_model_from_sqlite_row"]);
    assert_eq!(
        model.problem_kinds,
        &[StorageProblemKind::OptimizerRecordDecodeFailed]
    );

    let upsert = command("optimizer.feed-row-height-model.upsert")?;
    assert_optimizer_write(
        upsert,
        &["feed_row_height_models.upsert"],
        &["feed_row_height_models"],
        &["sqlite_feed_row_height_model_row"],
    );
    Ok(())
}

fn assert_optimizer_write(
    command: &lkjstr_storage::StorageRepositoryCommandSpec,
    statements: &[&str],
    tables: &[&str],
    row_codecs: &[&str],
) {
    assert_eq!(command.operation, StorageOperation::Write);
    assert_eq!(command.statements, statements);
    assert_eq!(command.tables, tables);
    assert_eq!(command.row_codecs, row_codecs);
    assert!(
        command
            .problem_kinds
            .contains(&StorageProblemKind::OptimizerRecordDecodeFailed)
    );
    assert!(
        command
            .problem_kinds
            .contains(&StorageProblemKind::QuotaOrWriteFailed)
    );
}

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}

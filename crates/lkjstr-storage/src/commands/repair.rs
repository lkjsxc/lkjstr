#![doc = "Repair storage command metadata."]

pub use crate::repair::{
    RepairBackfillInput, RepairBackfillOutput, RepairInventoryReportInput,
    RepairInventoryReportOutput, RepairScanInput, RepairScanOutput, RepairTargetProbeInput,
    RepairTargetProbeOutput,
};

use crate::{
    StorageDataClass as Class, StorageOperation as Op, StorageProblemKind as Problem,
    commands::spec::{
        StorageCommandFamily as Family, StorageLedgerPolicy as Ledger,
        StorageProtectionPolicy as Protection, StorageRepositoryCommandSpec as Spec,
        StorageStatsProjection as Stats,
    },
};

const REPAIR_PROBLEMS: &[Problem] = &[
    Problem::RepairSchemaMismatch,
    Problem::RepairCorruptRow,
    Problem::RepairDecodeFailure,
    Problem::RepairOrphanLedgerRow,
    Problem::RepairOrphanResourceRow,
    Problem::RepairIncompleteInventory,
    Problem::RepairTemporaryMemoryMode,
    Problem::RepairUnknownUnownedRow,
    Problem::RepairSkippedUnknownRow,
    Problem::RepairBackfillPlanned,
    Problem::RepairBackfillApplied,
    Problem::RepairChunkContinuation,
    Problem::UnavailableBrowserCapability,
    Problem::Timeout,
    Problem::Blocked,
];

const REPAIR_CLASSES: &[Class] = &[
    Class::Ledger,
    Class::RecoverableCache,
    Class::DerivedFeedCache,
    Class::DiagnosticsCache,
    Class::Metadata,
];

const REPAIR_TABLES: &[&str] = &[
    "cache_ledger",
    "events",
    "event_tags",
    "event_relays",
    "notifications",
    "feed_cursors",
    "feed_coverage",
    "feed_scan_hints",
    "jobs",
    "relay_information",
    "relay_diagnostic_summaries",
    "relay_read_observations",
    "relay_read_scores",
    "relay_list_suggestions",
    "author_relay_routes",
    "route_evidence_scores",
    "feed_scan_observations",
    "feed_scan_density_models",
    "feed_scan_decision_traces",
    "app_log",
];

pub const REPAIR_SCAN_LEDGER_COMMAND: Spec = Spec {
    id: "repair.scan-ledger",
    family: Family::Repair,
    operation: Op::Repair,
    input_type: "RepairScanInput",
    output_type: "RepairScanOutput",
    statements: &["cache_ledger.select"],
    tables: REPAIR_TABLES,
    row_codecs: &[
        "sqlite_cache_ledger_row",
        "repair_scan_row",
        "repair_finding",
    ],
    problem_kinds: REPAIR_PROBLEMS,
    data_classes: REPAIR_CLASSES,
    ledger_policy: Ledger::RepairsLedger,
    protection_policy: Protection::Mixed,
    stats_projection: Stats::CacheSummary,
};

pub const REPAIR_BACKFILL_LEDGER_COMMAND: Spec = Spec {
    id: "repair.backfill-ledger",
    family: Family::Repair,
    operation: Op::Repair,
    input_type: "RepairBackfillInput",
    output_type: "RepairBackfillOutput",
    statements: &["cache_ledger.upsert"],
    tables: REPAIR_TABLES,
    row_codecs: &[
        "sqlite_cache_ledger_row",
        "repair_backfill_plan",
        "repair_finding",
    ],
    problem_kinds: REPAIR_PROBLEMS,
    data_classes: REPAIR_CLASSES,
    ledger_policy: Ledger::RepairsLedger,
    protection_policy: Protection::Mixed,
    stats_projection: Stats::CacheSummary,
};

pub const REPAIR_PROBE_TARGETS_COMMAND: Spec = Spec {
    id: "repair.probe-targets",
    family: Family::Repair,
    operation: Op::Repair,
    input_type: "RepairTargetProbeInput",
    output_type: "RepairTargetProbeOutput",
    statements: &[
        "events.repair_probe",
        "notifications.repair_probe",
        "feed_cursors.repair_probe",
        "feed_coverage.repair_probe",
        "feed_scan_hints.repair_probe",
        "relay_diagnostic_summaries.repair_probe",
        "relay_information.repair_probe",
        "relay_read_observations.repair_probe",
        "relay_read_scores.repair_probe",
        "relay_list_suggestions.repair_probe",
        "author_relay_routes.repair_probe",
        "route_evidence_scores.repair_probe",
        "jobs.repair_probe",
    ],
    tables: REPAIR_TABLES,
    row_codecs: &["repair_probe_target", "repair_probe_hit", "repair_scan_row"],
    problem_kinds: REPAIR_PROBLEMS,
    data_classes: REPAIR_CLASSES,
    ledger_policy: Ledger::RepairsLedger,
    protection_policy: Protection::Mixed,
    stats_projection: Stats::CacheSummary,
};

pub const REPAIR_REPORT_INVENTORY_COMMAND: Spec = Spec {
    id: "repair.report-inventory",
    family: Family::Repair,
    operation: Op::Repair,
    input_type: "RepairInventoryReportInput",
    output_type: "RepairInventoryReportOutput",
    statements: &[],
    tables: &[],
    row_codecs: &["repair_inventory_report", "repair_finding"],
    problem_kinds: &[
        Problem::RepairIncompleteInventory,
        Problem::RepairTemporaryMemoryMode,
        Problem::RepairChunkContinuation,
        Problem::UnavailableBrowserCapability,
        Problem::Timeout,
        Problem::Blocked,
    ],
    data_classes: &[Class::Metadata],
    ledger_policy: Ledger::None,
    protection_policy: Protection::InventoryOnly,
    stats_projection: Stats::Inventory,
};

pub const REPAIR_COMMANDS: &[Spec] = &[
    REPAIR_SCAN_LEDGER_COMMAND,
    REPAIR_PROBE_TARGETS_COMMAND,
    REPAIR_BACKFILL_LEDGER_COMMAND,
    REPAIR_REPORT_INVENTORY_COMMAND,
];

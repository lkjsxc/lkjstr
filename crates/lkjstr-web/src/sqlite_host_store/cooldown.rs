use std::cell::RefCell;
use std::collections::BTreeMap;

use lkjstr_storage::{StorageOperation, StorageOutcome, StorageProblem};

const OWNER_COOLDOWN_MS: f64 = 2_000.0;

thread_local! {
    static COOLDOWNS: RefCell<BTreeMap<String, Cooldown>> = const { RefCell::new(BTreeMap::new()) };
}

#[derive(Clone)]
struct Cooldown {
    until_ms: f64,
    reason: &'static str,
}

pub(super) fn active_owner_block(database_name: &str, worker_url: &str) -> Option<StorageOutcome<()>> {
    let key = key(database_name, worker_url);
    COOLDOWNS.with(|cooldowns| {
        let mut cooldowns = cooldowns.borrow_mut();
        let cooldown = cooldowns.get(&key)?;
        if cooldown.until_ms <= now_ms() {
            cooldowns.remove(&key);
            return None;
        }
        Some(outcome(cooldown.reason, problem(cooldown.reason, key)))
    })
}

pub(super) fn start_if_owner_blocked<T>(
    database_name: &str,
    worker_url: &str,
    outcome: &StorageOutcome<T>,
) {
    let Some(problem) = outcome.problem() else {
        return;
    };
    let reason = match problem.reason {
        "opfs-owner-held" => "opfs-owner-held",
        "web-lock-unavailable" => "web-lock-unavailable",
        _ => return,
    };
    let key = key(database_name, worker_url);
    COOLDOWNS.with(|cooldowns| {
        cooldowns.borrow_mut().insert(
            key,
            Cooldown {
                until_ms: now_ms() + OWNER_COOLDOWN_MS,
                reason,
            },
        );
    });
}

fn outcome(reason: &'static str, problem: StorageProblem) -> StorageOutcome<()> {
    match reason {
        "web-lock-unavailable" => StorageOutcome::Blocked(problem),
        _ => StorageOutcome::Busy(problem),
    }
}

fn problem(reason: &'static str, operation_id: String) -> StorageProblem {
    StorageProblem::new(
        StorageOperation::Transaction,
        "sqlite_worker",
        reason,
        operation_id,
    )
}

fn key(database_name: &str, worker_url: &str) -> String {
    format!("{database_name}|{worker_url}")
}

fn now_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_millis() as f64)
            .unwrap_or(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_blocked_outcome_starts_busy_cooldown() {
        let problem = StorageProblem::new(
            StorageOperation::Transaction,
            "sqlite_worker",
            "opfs-owner-held",
            "open-1",
        );
        start_if_owner_blocked("/lkjstr/main.sqlite3", "/worker.js", &StorageOutcome::<()>::Busy(problem));

        let outcome = active_owner_block("/lkjstr/main.sqlite3", "/worker.js");
        assert!(matches!(outcome, Some(StorageOutcome::Busy(_))));
        if let Some(StorageOutcome::Busy(problem)) = outcome {
            assert_eq!(problem.reason, "opfs-owner-held");
        }
    }
}

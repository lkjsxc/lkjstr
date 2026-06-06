use lkjstr_storage::StorageOutcome;

pub fn browser_now_ms() -> u64 {
    js_sys::Date::now().max(0.0) as u64
}

pub fn problem_status<T>(prefix: &str, outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || prefix.to_owned(),
        |problem| format!("{prefix}: {}", problem.reason),
    )
}

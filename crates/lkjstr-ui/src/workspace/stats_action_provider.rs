use leptos::prelude::{Callable, Callback};

#[derive(Clone)]
pub struct StatsActions {
    run: Option<Callback<StatsActionCommand>>,
    compact: bool,
    repair: bool,
    unavailable_reason: String,
}

#[derive(Clone)]
pub enum StatsActionCommand {
    Compact(StatsActionComplete),
    Repair(StatsActionComplete),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StatsActionKind {
    Compact,
    Repair,
}

#[derive(Clone)]
pub struct StatsActionComplete {
    complete: Callback<StatsActionResult>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StatsActionResult {
    pub kind: StatsActionKind,
    pub status: String,
}

impl StatsActionComplete {
    pub fn complete(&self, result: StatsActionResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl StatsActionResult {
    #[must_use]
    pub fn new(kind: StatsActionKind, status: impl Into<String>) -> Self {
        Self {
            kind,
            status: status.into(),
        }
    }

    #[must_use]
    pub fn unavailable(kind: StatsActionKind, reason: &str) -> Self {
        Self::new(kind, format!("Storage action unavailable: {reason}"))
    }
}

impl StatsActions {
    #[must_use]
    pub fn new(
        run: impl Fn(StatsActionCommand) + Send + Sync + 'static,
        compact: bool,
        repair: bool,
    ) -> Self {
        Self {
            run: Some(Callback::new(run)),
            compact,
            repair,
            unavailable_reason: "action-not-provided".to_string(),
        }
    }

    #[must_use]
    pub fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            run: None,
            compact: false,
            repair: false,
            unavailable_reason: reason.into(),
        }
    }

    #[must_use]
    pub fn can_compact(&self) -> bool {
        self.compact && self.run.is_some()
    }

    #[must_use]
    pub fn can_repair(&self) -> bool {
        self.repair && self.run.is_some()
    }

    #[must_use]
    pub fn has_any_action(&self) -> bool {
        self.can_compact() || self.can_repair()
    }

    #[must_use]
    pub fn unavailable_text(&self) -> String {
        format!("Storage actions unavailable: {}", self.unavailable_reason)
    }

    pub fn compact(&self, complete: Callback<StatsActionResult>) {
        self.run_action(StatsActionKind::Compact, complete);
    }

    pub fn repair(&self, complete: Callback<StatsActionResult>) {
        self.run_action(StatsActionKind::Repair, complete);
    }

    fn run_action(&self, kind: StatsActionKind, complete: Callback<StatsActionResult>) {
        let complete = StatsActionComplete { complete };
        if !self.can_run_kind(kind) {
            complete.complete(StatsActionResult::unavailable(
                kind,
                &self.unavailable_reason,
            ));
            return;
        }
        if let Some(run) = &self.run {
            let command = match kind {
                StatsActionKind::Compact => StatsActionCommand::Compact(complete),
                StatsActionKind::Repair => StatsActionCommand::Repair(complete),
            };
            run.run(command);
        } else {
            complete.complete(StatsActionResult::unavailable(
                kind,
                &self.unavailable_reason,
            ));
        }
    }

    fn can_run_kind(&self, kind: StatsActionKind) -> bool {
        match kind {
            StatsActionKind::Compact => self.can_compact(),
            StatsActionKind::Repair => self.can_repair(),
        }
    }
}

#[cfg(test)]
#[path = "stats_action_provider_tests.rs"]
mod stats_action_provider_tests;

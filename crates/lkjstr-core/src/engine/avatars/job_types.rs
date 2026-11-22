#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Owner {
    pub client: u64,
    pub request: String,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    Lookup,
    Fetch,
    Derive,
    Store,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ticket {
    pub job: u64,
    pub stage: Stage,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Work {
    pub ticket: Ticket,
    pub key: String,
    pub timeout_ms: u64,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ResultKind {
    Ready { retained: bool },
    Fallback { uniform: bool },
    Deferred { retry_ms: u32 },
    Rejected,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Command {
    Run(Work),
    Abort(Ticket),
    Release(u64),
    Reply {
        owner: Owner,
        job: Option<u64>,
        result: ResultKind,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    Transient,
    Unsupported { uniform: bool },
    Capability,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Completion {
    Hit { bytes: u64 },
    Miss,
    StorageUnavailable,
    Fetched { bytes: u64 },
    Derived { bytes: u64 },
    Stored,
    StoreUnavailable,
    Failed(Failure),
    Cancelled,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Counts {
    pub owners: usize,
    pub jobs: usize,
    pub lookups: usize,
    pub fetches: usize,
    pub raw: usize,
    pub derives: usize,
    pub derived: usize,
    pub stores: usize,
    pub negatives: usize,
}
impl Failure {
    pub(super) fn result(self) -> ResultKind {
        ResultKind::Fallback {
            uniform: matches!(self, Self::Unsupported { uniform: true }),
        }
    }
}

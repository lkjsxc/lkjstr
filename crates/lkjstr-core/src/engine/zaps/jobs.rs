//! Bounded owner-scoped jobs; browser effects never own product policy.
use super::{
    Failure, InvoiceInput, InvoiceIntent, Phase, PreparedRequest, Quote, ReceiptCursor,
    ReceiptPage, Result, Target,
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[path = "jobs_invoice.rs"]
mod invoice;
#[path = "jobs_lifetime.rs"]
mod lifetime;
#[path = "jobs_query.rs"]
mod query;
#[path = "jobs_terminal.rs"]
mod terminal;
pub const MAX_QUERIES: usize = 16;
pub const MAX_INVOICES: usize = 4;
pub const QUERY_SECONDS: u64 = 20;
pub const INVOICE_SECONDS: u64 = 90;
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Owner {
    pub client: u64,
    pub req: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteInput {
    pub target: Target,
    pub amount_msat: Option<u64>,
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptInput {
    pub target: Target,
    pub before: Option<ReceiptCursor>,
    pub limit: usize,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Coverage {
    Loading,
    Observed,
    Truncated,
    Failed,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptView {
    pub target: Target,
    pub phase: Phase,
    pub error: Option<Failure>,
    pub coverage: Coverage,
    pub page: Option<ReceiptPage>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum QueryReply {
    Quote(Quote),
    Receipts(ReceiptView),
}
impl QueryReply {
    fn phase(&self) -> Phase {
        match self {
            Self::Quote(q) => q.phase,
            Self::Receipts(r) => r.phase,
        }
    }
}
enum Query {
    Quote(QuoteInput),
    Receipts(ReceiptInput),
}
impl Query {
    fn target(&self) -> &Target {
        match self {
            Self::Quote(q) => &q.target,
            Self::Receipts(r) => &r.target,
        }
    }
}
struct QueryJob {
    query: Query,
    deadline: u64,
    last: Option<QueryReply>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceBatch {
    pub state: super::IntentState,
    pub target: Target,
    pub amount_msat: u64,
    pub invoices: Vec<InvoiceIntent>,
}
#[derive(Clone, Debug)]
pub struct InvoiceWork {
    pub token: u64,
    pub owner: Owner,
    pub account: String,
    pub requests: Vec<PreparedRequest>,
    pub deadline: u64,
}
struct InvoiceJob {
    token: u64,
    owner: Owner,
    account: String,
    input: InvoiceInput,
    relays: Vec<String>,
    deadline: u64,
    requests: Option<Vec<PreparedRequest>>,
    accepted: Vec<InvoiceIntent>,
}
struct Completed {
    account: String,
    deadline: u64,
    requests: Vec<PreparedRequest>,
    result: Result<InvoiceBatch>,
}
impl Completed {
    fn fail(&mut self, error: Failure) {
        self.result = Err(error);
        self.requests.clear();
    }
}
#[derive(Default)]
pub struct Jobs {
    queries: BTreeMap<Owner, QueryJob>,
    invoices: BTreeMap<u64, InvoiceJob>,
    owners: BTreeMap<Owner, u64>,
    serial: u64,
    changed: bool,
    replies: BTreeMap<Owner, QueryReply>,
    outcomes: BTreeMap<Owner, Completed>,
    cancel: BTreeSet<u64>,
}
impl Jobs {
    pub fn targets(&self) -> Vec<Target> {
        self.invoices
            .values()
            .map(|j| j.input.target.clone())
            .chain(self.queries.values().map(|j| j.query.target().clone()))
            .collect()
    }
    pub fn changed(&mut self) -> bool {
        std::mem::take(&mut self.changed)
    }
    pub fn replies(&mut self) -> BTreeMap<Owner, QueryReply> {
        std::mem::take(&mut self.replies)
    }
    pub fn outcomes(&mut self) -> BTreeMap<Owner, Result<InvoiceBatch>> {
        std::mem::take(&mut self.outcomes)
            .into_iter()
            .map(|(owner, completed)| (owner, completed.result))
            .collect()
    }
    pub fn cancelled(&mut self) -> BTreeSet<u64> {
        std::mem::take(&mut self.cancel)
    }
    pub fn invoice_active(&self, token: u64, owner: &Owner, account: &str, now: u64) -> bool {
        self.invoices
            .get(&token)
            .is_some_and(|j| &j.owner == owner && j.account == account && now < j.deadline)
    }
    pub fn owns(&self, owner: &Owner) -> bool {
        self.queries.contains_key(owner)
            || self.owners.contains_key(owner)
            || self.replies.contains_key(owner)
            || self.outcomes.contains_key(owner)
    }
    fn available(&self, owner: &Owner) -> Result<()> {
        if owner.req.is_empty() || owner.req.len() > 128 {
            return Err(Failure::Rejected);
        }
        if self.owns(owner) {
            return Err(Failure::Rejected);
        }
        let reserved: BTreeSet<_> = self
            .queries
            .keys()
            .chain(self.owners.keys())
            .chain(self.replies.keys())
            .chain(self.outcomes.keys())
            .collect();
        if reserved.len() >= 64 || self.cancel.len() >= MAX_INVOICES {
            return Err(Failure::TooLarge);
        }
        Ok(())
    }
    fn finish(&mut self, token: u64, result: Result<InvoiceBatch>) {
        if let Some(job) = self.invoices.remove(&token) {
            self.owners.remove(&job.owner);
            self.outcomes.insert(
                job.owner,
                Completed {
                    account: job.account,
                    deadline: job.deadline,
                    requests: if result.is_ok() {
                        job.requests.clone().unwrap_or_default()
                    } else {
                        vec![]
                    },
                    result,
                },
            );
            if job.requests.is_some() {
                self.cancel.insert(token);
            }
            self.changed = true;
        }
    }
}

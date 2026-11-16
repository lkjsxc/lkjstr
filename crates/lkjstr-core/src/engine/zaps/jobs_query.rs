use super::super::quote::quote_plan;
use super::super::{Failure, Phase, Providers, Quote, Receipts, Result, Target, TargetPlan};
use super::{
    Coverage, Jobs, MAX_QUERIES, Owner, QUERY_SECONDS, Query, QueryJob, QueryReply, QuoteInput,
    ReceiptInput, ReceiptView,
};
use crate::store::Store;
use std::collections::BTreeMap;

impl Jobs {
    pub fn quote(&mut self, owner: Owner, input: QuoteInput, now: u64) -> Result<()> {
        self.open(owner, Query::Quote(input), now)
    }
    pub fn receipts(&mut self, owner: Owner, input: ReceiptInput, now: u64) -> Result<()> {
        if !(1..=super::super::receipt_list::MAX_ROWS).contains(&input.limit)
            || input.before.as_ref().is_some_and(|c| {
                c.at > super::super::MAX_MSAT || lkjstr_nips::unhex::<32>(&c.id).is_err()
            })
        {
            return Err(Failure::Rejected);
        }
        self.open(owner, Query::Receipts(input), now)
    }
    fn open(&mut self, owner: Owner, query: Query, now: u64) -> Result<()> {
        self.available(&owner)?;
        valid_target(query.target())?;
        if let Query::Quote(q) = &query
            && q.amount_msat
                .is_some_and(|a| a == 0 || a > super::super::MAX_MSAT)
        {
            return Err(Failure::Rejected);
        }
        if self.queries.len() >= MAX_QUERIES {
            return Err(Failure::TooLarge);
        }
        self.queries.insert(
            owner,
            QueryJob {
                query,
                deadline: now.saturating_add(QUERY_SECONDS),
                last: None,
            },
        );
        self.changed = true;
        Ok(())
    }
    pub fn project(
        &mut self,
        store: &Store,
        providers: &Providers,
        receipts: &Receipts,
        plans: &BTreeMap<Target, Result<TargetPlan>>,
        (coverage, missing): (&BTreeMap<Target, Coverage>, &BTreeMap<Target, Failure>),
        now: u64,
    ) {
        let mut done = vec![];
        for (owner, job) in &mut self.queries {
            let error = missing
                .get(job.query.target())
                .copied()
                .or_else(|| (now >= job.deadline).then_some(Failure::Network));
            let reply = match &job.query {
                Query::Quote(input) => {
                    let mut q = match plans
                        .get(&input.target)
                        .cloned()
                        .unwrap_or(Err(Failure::NotFound))
                        .and_then(|p| quote_plan(store, providers, &p, input.amount_msat, now))
                    {
                        Ok(q) => q,
                        Err(e) => Quote {
                            target: input.target.clone(),
                            recipients: vec![],
                            phase: if e == Failure::NotFound {
                                Phase::Loading
                            } else {
                                e.phase()
                            },
                            error: (e != Failure::NotFound).then_some(e),
                        },
                    };
                    if let Some(error) = error {
                        q.phase = error.phase();
                        q.error = Some(error);
                    }
                    QueryReply::Quote(q)
                }
                Query::Receipts(input) => {
                    let coverage = coverage
                        .get(&input.target)
                        .copied()
                        .unwrap_or(Coverage::Loading);
                    let page = receipts
                        .page(
                            store,
                            providers,
                            &input.target,
                            input.before.as_ref(),
                            input.limit,
                            now,
                        )
                        .ok();
                    let phase = if let Some(error) = error {
                        error.phase()
                    } else {
                        match coverage {
                            Coverage::Loading => Phase::Loading,
                            Coverage::Failed => Phase::Failed,
                            _ => page.as_ref().map_or(Phase::Failed, |p| p.total.phase),
                        }
                    };
                    QueryReply::Receipts(ReceiptView {
                        target: input.target.clone(),
                        phase,
                        error: error
                            .or_else(|| (coverage == Coverage::Failed).then_some(Failure::Network)),
                        coverage,
                        page,
                    })
                }
            };
            if job.last.as_ref() != Some(&reply) {
                job.last = Some(reply.clone());
                self.replies.insert(owner.clone(), reply.clone());
            }
            if reply.phase() != Phase::Loading {
                done.push(owner.clone());
            }
        }
        for owner in done {
            self.queries.remove(&owner);
            self.changed = true;
        }
    }
    pub fn receipt_targets(&self) -> Vec<Target> {
        self.queries
            .values()
            .filter_map(|q| match &q.query {
                Query::Receipts(input) => Some(input.target.clone()),
                _ => None,
            })
            .collect()
    }
}
pub(super) fn valid_target(target: &Target) -> Result<()> {
    match target {
        Target::Event { id } if lkjstr_nips::unhex::<32>(id).is_ok() => Ok(()),
        Target::Profile { pubkey } => {
            lkjstr_nips::lnurl::public_key(pubkey).map_err(|_| Failure::Rejected)
        }
        _ => Err(Failure::Rejected),
    }
}

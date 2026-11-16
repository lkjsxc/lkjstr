use super::super::quote::{invoice_plan_for, quote_plan};
use super::super::{Failure, InvoiceInput, Phase, Providers, Result, Target, TargetPlan, invoice};
use super::{INVOICE_SECONDS, InvoiceBatch, InvoiceJob, InvoiceWork, Jobs, MAX_INVOICES, Owner};
use crate::store::Store;
use lkjstr_nips::{event::Event, identity::HttpResponse};
use std::collections::BTreeMap;

impl Jobs {
    pub fn invoice(
        &mut self,
        owner: Owner,
        account: String,
        input: InvoiceInput,
        relays: Vec<String>,
        now: u64,
    ) -> Result<u64> {
        self.available(&owner)?;
        super::query::valid_target(&input.target)?;
        lkjstr_nips::lnurl::public_key(&account).map_err(|_| Failure::Rejected)?;
        if self.invoices.len() >= MAX_INVOICES {
            return Err(Failure::TooLarge);
        }
        if input.amount_msat == 0
            || input.amount_msat > super::super::MAX_MSAT
            || input.comment.len() > 4096
            || relays.is_empty()
            || relays.len() > 16
        {
            return Err(Failure::Rejected);
        }
        for relay in &relays {
            lkjstr_nips::relay::relay_url(relay).map_err(|_| Failure::Rejected)?;
        }
        self.serial = self.serial.checked_add(1).ok_or(Failure::TooLarge)?;
        let token = self.serial;
        self.owners.insert(owner.clone(), token);
        self.invoices.insert(
            token,
            InvoiceJob {
                token,
                owner,
                account,
                input,
                relays,
                deadline: now.saturating_add(INVOICE_SECONDS),
                requests: None,
                accepted: vec![],
            },
        );
        self.changed = true;
        Ok(token)
    }
    /// No signature starts until every split recipient passes provider preflight.
    pub fn prepare_invoices(
        &mut self,
        store: &Store,
        providers: &Providers,
        plans: &BTreeMap<Target, Result<TargetPlan>>,
        now: u64,
    ) -> Vec<InvoiceWork> {
        self.expire(now);
        self.revalidate_outcomes(store, now);
        let mut work = vec![];
        let mut failed = vec![];
        for (token, job) in &mut self.invoices {
            if let Some(requests) = &job.requests {
                if let Some(error) = requests.iter().find_map(|r| r.current(store, now).err()) {
                    failed.push((*token, error));
                }
                continue;
            }
            let Some(Ok(plan)) = plans.get(&job.input.target) else {
                continue;
            };
            let quote = match quote_plan(store, providers, plan, Some(job.input.amount_msat), now) {
                Ok(q) => q,
                Err(Failure::NotFound) => continue,
                Err(error) => {
                    failed.push((*token, error));
                    continue;
                }
            };
            match quote.phase {
                Phase::Loading => continue,
                Phase::Failed | Phase::Unsupported => {
                    let error = quote
                        .recipients
                        .iter()
                        .find_map(|r| r.error)
                        .unwrap_or(Failure::Unsupported);
                    failed.push((*token, error));
                    continue;
                }
                Phase::Ready => {}
            }
            match invoice_plan_for(
                store,
                providers,
                plan,
                &job.input,
                &job.account,
                &job.relays,
                now,
            ) {
                Ok(requests) => {
                    work.push(InvoiceWork {
                        token: job.token,
                        owner: job.owner.clone(),
                        account: job.account.clone(),
                        requests: requests.clone(),
                        deadline: job.deadline,
                    });
                    job.requests = Some(requests);
                }
                Err(error) => failed.push((*token, error)),
            }
        }
        for (token, error) in failed {
            self.finish(token, Err(error));
        }
        work
    }
    pub fn callback(
        &self,
        store: &Store,
        token: u64,
        index: usize,
        signed: &Event,
        now: u64,
    ) -> Result<(String, String)> {
        let job = self.invoices.get(&token).ok_or(Failure::Cancelled)?;
        if now >= job.deadline || job.accepted.len() != index {
            return Err(Failure::Stale);
        }
        let request = job
            .requests
            .as_ref()
            .and_then(|r| r.get(index))
            .ok_or(Failure::Rejected)?;
        request.callback(store, signed, now)
    }
    /// Each exact HTTP result is revalidated in core. Partial invoices never leave
    /// the job; a failed recipient produces only a failed overall result.
    pub fn invoice_response(
        &mut self,
        store: &Store,
        token: u64,
        index: usize,
        (request_json, callback, response): (&str, &str, Result<HttpResponse>),
        now: u64,
    ) -> bool {
        let Some(job) = self.invoices.get_mut(&token) else {
            return false;
        };
        if now >= job.deadline || job.accepted.len() != index {
            self.finish(token, Err(Failure::Stale));
            return false;
        }
        let result = (|| {
            let requests = job.requests.as_ref().ok_or(Failure::Rejected)?;
            for request in requests {
                request.current(store, now)?;
            }
            if job.accepted.iter().any(|i| i.expires_at <= now) {
                return Err(Failure::Expired);
            }
            let prepared = requests.get(index).ok_or(Failure::Rejected)?;
            response.and_then(|r| invoice(store, prepared, request_json, callback, &r, now))
        })();
        match result {
            Ok(intent) => {
                job.accepted.push(intent);
                if job
                    .requests
                    .as_ref()
                    .is_some_and(|r| r.len() == job.accepted.len())
                {
                    let batch = InvoiceBatch {
                        state: super::super::IntentState::Unpaid,
                        target: job.input.target.clone(),
                        amount_msat: job.input.amount_msat,
                        invoices: std::mem::take(&mut job.accepted),
                    };
                    self.finish(token, Ok(batch));
                }
            }
            Err(error) => self.finish(token, Err(error)),
        }
        true
    }
}

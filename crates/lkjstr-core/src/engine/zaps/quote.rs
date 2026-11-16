//! Quotes are read-only. All split recipients pass preflight before any signature.
use super::{
    Failure, Phase, PreparedRequest, Providers, Result, Target, allocations, prepare, target,
};
use crate::store::Store;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteRecipient {
    pub pubkey: String,
    pub phase: Phase,
    pub error: Option<Failure>,
    pub amount_msat: Option<u64>,
    pub min_msat: Option<u64>,
    pub max_msat: Option<u64>,
    pub provider: Option<String>,
    pub domain: Option<String>,
    pub description: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Quote {
    pub target: Target,
    pub phase: Phase,
    pub error: Option<Failure>,
    pub recipients: Vec<QuoteRecipient>,
}
pub fn quote(
    store: &Store,
    providers: &Providers,
    value: &Target,
    amount_msat: Option<u64>,
    now: u64,
) -> Result<Quote> {
    quote_plan(store, providers, &target(store, value)?, amount_msat, now)
}
pub(super) fn quote_plan(
    store: &Store,
    providers: &Providers,
    plan: &super::TargetPlan,
    amount_msat: Option<u64>,
    now: u64,
) -> Result<Quote> {
    let shares = amount_msat.map(|n| allocations(plan, n)).transpose()?;
    let mut recipients = vec![];
    let mut phase = Phase::Ready;
    for recipient in &plan.recipients {
        let provider = providers.get(store, &recipient.pubkey, now);
        let amount = shares
            .as_ref()
            .and_then(|s| s.iter().find(|(key, _)| key == &recipient.pubkey))
            .map(|(_, n)| *n);
        let (mut state, mut error) = providers.status(store, &recipient.pubkey, now);
        if provider
            .as_ref()
            .zip(amount)
            .is_some_and(|(p, n)| n < p.min_msat || n > p.max_msat)
        {
            state = Phase::Failed;
            error = Some(Failure::Rejected);
        }
        phase = combine(phase, state);
        recipients.push(QuoteRecipient {
            pubkey: recipient.pubkey.clone(),
            phase: state,
            error,
            amount_msat: amount,
            min_msat: provider.as_ref().map(|p| p.min_msat),
            max_msat: provider.as_ref().map(|p| p.max_msat),
            provider: provider.as_ref().map(|p| p.nostr_pubkey.clone()),
            domain: provider
                .as_ref()
                .and_then(|p| url::Url::parse(&p.binding.endpoint).ok())
                .and_then(|u| u.host_str().map(str::to_owned)),
            description: provider.as_ref().map(|p| p.description.clone()),
        });
    }
    Ok(Quote {
        target: plan.target.clone(),
        phase,
        error: recipients.iter().find_map(|r| r.error),
        recipients,
    })
}
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceInput {
    pub target: Target,
    pub amount_msat: u64,
    pub comment: String,
}
pub fn invoice_plan(
    store: &Store,
    providers: &Providers,
    input: &InvoiceInput,
    sender: &str,
    relays: &[String],
    now: u64,
) -> Result<Vec<PreparedRequest>> {
    invoice_plan_for(
        store,
        providers,
        &target(store, &input.target)?,
        input,
        sender,
        relays,
        now,
    )
}
pub(super) fn invoice_plan_for(
    store: &Store,
    providers: &Providers,
    plan: &super::TargetPlan,
    input: &InvoiceInput,
    sender: &str,
    relays: &[String],
    now: u64,
) -> Result<Vec<PreparedRequest>> {
    let amounts = allocations(plan, input.amount_msat)?;
    let mut requests = vec![];
    for (recipient, amount) in amounts {
        let provider = providers.get(store, &recipient, now).ok_or_else(|| {
            providers
                .status(store, &recipient, now)
                .1
                .unwrap_or(Failure::NotFound)
        })?;
        requests.push(prepare(
            plan,
            &provider,
            sender,
            amount,
            &input.comment,
            relays,
            now,
        )?);
    }
    Ok(requests)
}
fn combine(a: Phase, b: Phase) -> Phase {
    for phase in [Phase::Failed, Phase::Unsupported, Phase::Loading] {
        if a == phase || b == phase {
            return phase;
        }
    }
    Phase::Ready
}

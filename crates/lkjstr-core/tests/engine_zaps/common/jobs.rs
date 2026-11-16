use super::*;
use std::collections::BTreeMap;
pub fn owner(req: &str) -> Owner {
    Owner {
        client: 1,
        req: req.into(),
    }
}
pub fn input(target: &Target) -> InvoiceInput {
    InvoiceInput {
        target: target.clone(),
        amount_msat: 21_000,
        comment: "signed comment".into(),
    }
}
pub fn tick(state: &mut State, store: &lkjstr_core::store::Store, now: u64) {
    state.tick(store, &[], &BTreeMap::new(), &BTreeMap::new(), now);
}
pub fn start() -> (lkjstr_core::store::Store, State, InvoiceWork) {
    let (store, providers, target) = setup();
    let mut state = State::default();
    state.providers = providers;
    state
        .jobs
        .invoice(
            owner("invoice"),
            key(1).public_key(),
            input(&target),
            vec!["wss://relay.test".into()],
            100,
        )
        .unwrap();
    tick(&mut state, &store, 100);
    let work = state.effects().invoices.remove(0);
    (store, state, work)
}

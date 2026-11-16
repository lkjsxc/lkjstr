//! Seen snapshots trust and exceptions in the same account persistence transaction.
use crate::engine::{
    Engine, query,
    zaps::{ReadSnapshot, ReadState},
};
use std::collections::BTreeSet;
#[derive(Default)]
pub struct NotificationMark {
    pub at: u64,
    pub ties: BTreeSet<String>,
    pub zaps: ReadState,
}
pub fn notification_read_mark(engine: &Engine, account: &str) -> NotificationMark {
    let (at, ties) = super::notifications::notification_watermark(engine, account);
    let query = crate::engine::protocol::Query {
        source: crate::engine::protocol::Source::Notifications,
        account: Some(account.into()),
        ..Default::default()
    };
    let events = query::events(&engine.store, &query);
    let mut state = engine
        .notification_zaps
        .get(account)
        .cloned()
        .unwrap_or_default();
    state.normalize();
    let mut snapshot = ReadSnapshot::default();
    for id in state.deferred().chain(
        events
            .iter()
            .filter(|e| e.kind == 9735)
            .map(|e| e.id.as_str()),
    ) {
        if let Some(payment) = engine.zaps.receipts.logical_id(&engine.store, id) {
            snapshot.payments.insert(id.into(), payment);
        }
        if engine.zaps.receipts.rejected(id) {
            snapshot.invalid.insert(id.into());
        }
    }
    for event in events.iter().filter(|event| event.kind == 9735) {
        let evidence = engine.zaps.receipts.evidence(
            &engine.store,
            &engine.zaps.providers,
            [event.id.as_str()],
            engine.network.now / 1000,
        );
        if evidence.unverified > 0 {
            snapshot.pending.insert(event.id.clone());
        }
        if super::notification_subject::subject(engine, &query, event, account).is_some()
            && let Some(payment) = snapshot.payments.get(&event.id)
        {
            snapshot.acknowledged.insert(payment.clone());
        }
    }
    state.acknowledge(snapshot);
    NotificationMark {
        at,
        ties,
        zaps: state,
    }
}
pub(super) fn aliases(engine: &Engine, account: &str) -> BTreeSet<String> {
    engine
        .notification_zaps
        .get(account)
        .into_iter()
        .flat_map(|state| state.deferred())
        .filter_map(|id| engine.zaps.receipts.logical_id(&engine.store, id))
        .collect()
}
pub(super) fn unread(
    engine: &Engine,
    account: &str,
    event: &lkjstr_protocol::NostrEvent,
    aliases: &BTreeSet<String>,
    ordinary: bool,
) -> bool {
    if event.kind != 9735 {
        return ordinary;
    }
    let Some(state) = engine.notification_zaps.get(account) else {
        return ordinary;
    };
    let Some(payment) = engine.zaps.receipts.logical_id(&engine.store, &event.id) else {
        return ordinary;
    };
    state.is_unread(&event.id, &payment, aliases, ordinary)
}

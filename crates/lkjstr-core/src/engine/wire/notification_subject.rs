//! One authorization/mute decision feeds rows, badges and read-watermark ties.
use crate::engine::{Engine, protocol::Query, query, zaps::Sender};
use lkjstr_protocol::NostrEvent;
pub(super) fn subject(
    engine: &Engine,
    q: &Query,
    raw: &NostrEvent,
    account: &str,
) -> Option<NostrEvent> {
    if crate::engine::acts::is_act(raw.kind)
        && crate::engine::acts::target(raw)
            .and_then(|id| engine.store.get(&id))
            .is_some_and(|target| {
                crate::engine::acts::is_act(target.kind) && target.pubkey != account
            })
    {
        return None;
    }
    let event = if raw.kind == 9735 {
        let trusted = engine.zaps.receipts.get(&engine.store, &raw.id)?;
        let description = lkjstr_nips::event::unique(&raw.tags, "description").ok()??;
        let request = lkjstr_protocol::parse_nostr_event_json(description, None).ok()?;
        if !matches!(trusted.payer, Sender::Public { .. }) && request.pubkey == account {
            return None;
        }
        request
    } else {
        raw.clone()
    };
    if event.pubkey == account
        || query::hidden_with_lists(&engine.store, q, &event, &engine.private_lists).is_some()
    {
        return None;
    }
    Some(event)
}

//! Bounded grouping over the retained 6000-event query slice; actors cap at eight.
use super::{Query, note};
use crate::engine::{Engine, query, rows};
use lkjstr_protocol as p;
use serde_json::{Value, json};
pub(super) fn notifications(q: &Query, e: &Engine) -> Vec<Value> {
    let Some(account) = q.account.as_deref() else {
        return vec![];
    };
    let Some(converted) = q.convert() else {
        return vec![];
    };
    let seen = e.seen.get(account).copied().unwrap_or(0);
    let aliases = super::notification_read::aliases(e, account);
    let mut groups: Vec<Value> = vec![];
    for event in query::events(&e.store, &converted) {
        let Some(subject) = super::notification_subject::subject(e, &converted, &event, account)
        else {
            continue;
        };
        let parent = p::reply_parent(&event);
        let kind = match event.kind {
            6 | 16 => "repost",
            7 => "reaction",
            9735 => "zap",
            _ => {
                if parent
                    .as_deref()
                    .and_then(|id| e.store.get(id))
                    .is_some_and(|v| v.pubkey == account)
                {
                    "reply"
                } else {
                    "mention"
                }
            }
        };
        if q.types
            .as_ref()
            .is_some_and(|types| !types.iter().any(|t| t == kind))
        {
            continue;
        }
        let target = crate::engine::acts::target(&event);
        let group = if matches!(kind, "reaction" | "repost") {
            format!(
                "notification:{kind}:{}:{}",
                target.as_deref().unwrap_or(""),
                if kind == "reaction" {
                    crate::reactions::label(&event.content)
                } else {
                    ""
                }
            )
        } else {
            event.id.clone()
        };
        let at = event.created_at.saturating_mul(1000);
        let unread = at > seen
            || (at == seen
                && e.notification_ties
                    .get(account)
                    .is_some_and(|ids| !ids.contains(&event.id)));
        let unread = super::notification_read::unread(e, account, &event, &aliases, unread);
        let actor = note::author(&rows::author(&e.store, &subject.pubkey));
        if let Some(row) = groups.iter_mut().find(|r| r["key"] == group) {
            let Some(actors) = row["actors"].as_array_mut() else {
                continue;
            };
            if !actors.iter().any(|a| a["pubkey"] == subject.pubkey) {
                if actors.len() < 8 {
                    actors.push(actor);
                } else {
                    row["others"] = json!(row["others"].as_u64().unwrap_or(0) + 1);
                }
            }
            if unread {
                row["unread"] = json!(true);
            }
            continue;
        }
        let mut row = json!({"kind":"notification","key":group,"type":kind,"actors":[actor],"others":0,"at":at,"unread":unread});
        if matches!(event.kind, 1 | 42) {
            row["note"] = note::note(
                &rows::row_with_lists(&e.store, &event, Some(account), 0, &e.private_lists),
                &e.store,
                Some(account),
            );
        }
        if event.kind == 7 {
            let mut emoji = json!({"emoji":crate::reactions::label(&event.content)});
            if let Some(url) = crate::reactions::image_url(&event) {
                emoji["url"] = json!(url);
            }
            row["emoji"] = emoji;
        }
        if event.kind == 9735 {
            let Some(zap) = e.zaps.receipts.get(&e.store, &event.id) else {
                continue;
            };
            row["sats"] = json!(zap.amount_msat / 1000);
            row["zapReceipt"] = json!(crate::engine::zaps::ReceiptRow::from(zap));
            row["actors"] = match &zap.payer {
                crate::engine::zaps::Sender::Public { pubkey } => {
                    json!([note::author(&rows::author(&e.store, pubkey))])
                }
                _ => json!([]),
            };
            if let Some(comment) = zap.comment(&e.store) {
                row["comment"] = json!(comment);
            }
        }
        if let Some(id) = target {
            super::acts::target(&mut row, e, &id, Some(account));
        }
        groups.push(row);
    }
    groups
}

/// Timestamp ties are remembered so a new event in the same second remains unread.
pub fn notification_watermark(
    engine: &crate::engine::Engine,
    account: &str,
) -> (u64, std::collections::BTreeSet<String>) {
    let query = crate::engine::protocol::Query {
        source: crate::engine::protocol::Source::Notifications,
        account: Some(account.into()),
        ..Default::default()
    };
    let events = crate::engine::query::events(&engine.store, &query)
        .into_iter()
        .filter(|event| {
            super::notification_subject::subject(engine, &query, event, account).is_some()
        })
        .collect::<Vec<_>>();
    let at = events
        .iter()
        .map(|e| e.created_at.saturating_mul(1000))
        .max()
        .unwrap_or(0)
        .max(engine.seen.get(account).copied().unwrap_or(0));
    (
        at,
        events
            .iter()
            .filter(|e| e.created_at.saturating_mul(1000) == at)
            .take(6000)
            .map(|e| e.id.clone())
            .collect(),
    )
}

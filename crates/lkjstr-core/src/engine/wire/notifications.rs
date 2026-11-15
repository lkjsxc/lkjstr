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
    let mut groups: Vec<Value> = vec![];
    for event in query::events(&e.store, &converted) {
        if event.pubkey == account
            || query::hidden_with_lists(&e.store, &converted, &event, &e.private_lists).is_some()
        {
            continue;
        }
        let parent = p::reply_parent(&event);
        let kind = match event.kind {
            3 => "follow",
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
        let target = p::tags::tag_values(&event, "e").last().cloned();
        let group = if matches!(kind, "reaction" | "repost") {
            format!(
                "notification:{kind}:{}:{}",
                target.as_deref().unwrap_or(""),
                if kind == "reaction" {
                    event.content.as_str()
                } else {
                    ""
                }
            )
        } else {
            event.id.clone()
        };
        let at = event.created_at.saturating_mul(1000);
        let actor = note::author(&rows::author(&e.store, &event.pubkey));
        if let Some(row) = groups.iter_mut().find(|r| r["key"] == group) {
            let Some(actors) = row["actors"].as_array_mut() else {
                continue;
            };
            if !actors.iter().any(|a| a["pubkey"] == event.pubkey) {
                if actors.len() < 8 {
                    actors.push(actor);
                } else {
                    row["others"] = json!(row["others"].as_u64().unwrap_or(0) + 1);
                }
            }
            if at > seen {
                row["unread"] = json!(true);
            }
            continue;
        }
        let mut row = json!({"kind":"notification","key":group,"type":kind,"actors":[actor],"others":0,"at":at,"unread":at>seen});
        if matches!(event.kind, 1 | 42) {
            row["note"] = note::note(
                &rows::row_with_lists(&e.store, &event, Some(account), 0, &e.private_lists),
                &e.store,
                Some(account),
            );
        }
        if event.kind == 7 {
            let mut emoji = json!({"emoji":event.content});
            if let Some(custom) = p::custom_emojis(&event).first() {
                emoji["url"] = json!(custom.url);
            }
            row["emoji"] = emoji;
        }
        if event.kind == 9735 {
            row["sats"] = json!(p::zap_receipt_amount_msats(&event).unwrap_or(0) / 1000);
            if let Some(description) = p::first_tag_value(&event, "description")
                .and_then(|raw| p::parse_nostr_event_json(&raw, None).ok())
            {
                row["actors"] = json!([note::author(&rows::author(&e.store, &description.pubkey))]);
                row["comment"] = json!(description.content);
            }
        }
        if let Some(id) = target
            && let Some(target) = e.store.get(&id)
        {
            row["target"] = json!({"id":id,"excerpt":target.content.chars().take(160).collect::<String>(),"media":p::embedded_media_attachments(&target).len()});
        }
        groups.push(row);
    }
    groups
}

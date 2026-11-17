//! Additive act display models; no counts ever move from an act to its note.
use crate::engine::{Engine, acts, query, rows};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};

fn act_ref(engine: &Engine, event: &NostrEvent) -> Option<Value> {
    let kind = match event.kind {
        7 => "reaction",
        6 | 16 => "repost",
        _ => return None,
    };
    let mut value = json!({"type":kind,"actor":super::note::author(&rows::author(&engine.store,&event.pubkey))});
    if event.kind == 7 {
        let mut emoji = json!({"emoji":crate::reactions::label(&event.content)});
        if let Some(custom) = lkjstr_protocol::custom_emojis(event)
            .into_iter()
            .find(|emoji| event.content == format!(":{}:", emoji.shortcode))
        {
            emoji["url"] = json!(custom.url);
        }
        value["emoji"] = emoji;
    }
    Some(value)
}
fn lookup_state(engine: &Engine, id: &str) -> &'static str {
    if !engine.queue.is_empty() || engine.network.verifying {
        return "loading";
    }
    let requests: Vec<_> = engine
        .network
        .requests
        .values()
        .filter(|request| {
            request
                .filter
                .ids
                .as_ref()
                .is_some_and(|ids| ids.iter().any(|key| key == id))
        })
        .collect();
    if requests.is_empty()
        || requests
            .iter()
            .any(|request| !request.complete && !request.eose)
    {
        return "loading";
    }
    if requests.iter().all(|request| {
        request.asked
            && request.eose
            && request.received.len() < request.page_limit
            && !request.received.contains(id)
    }) {
        "missing"
    } else {
        "failed"
    }
}
pub(super) fn target(row: &mut Value, engine: &Engine, id: &str) {
    let chain = acts::from_target(&engine.store, id);
    let context = chain
        .first
        .as_ref()
        .and_then(|first| act_ref(engine, first));
    let trusted = chain.trusted(engine);
    if let Some(note) = chain.note.as_ref().filter(|_| trusted) {
        let mut value = json!({"id":note.id,"excerpt":note.content.chars().take(160).collect::<String>(),
            "media":lkjstr_protocol::embedded_media_attachments(note).len()});
        if let Some(context) = context {
            value["act"] = context;
        }
        row["target"] = value;
        if let Some(object) = row.as_object_mut() {
            object.remove("pendingAct");
        }
    } else if let Some(context) = context {
        if let Some(object) = row.as_object_mut() {
            object.remove("target");
        }
        let state = if trusted {
            chain
                .missing
                .as_deref()
                .map(|id| lookup_state(engine, id))
                .unwrap_or("failed")
        } else {
            "failed"
        };
        row["pendingAct"] = json!({"act":context,"state":state});
    } else if let Some(object) = row.as_object_mut() {
        object.remove("target");
        object.remove("pendingAct");
    }
}
/// EOSE/refusal can settle a chain without any newly admitted event.
pub(super) fn settle(row: &mut Value, engine: &Engine) {
    if row["kind"] != "notification" {
        return;
    }
    let id = row["key"].as_str().and_then(|key| {
        if key.starts_with("notification:") {
            key.split(':')
                .nth(2)
                .filter(|id| lkjstr_protocol::is_event_id(id))
                .map(str::to_owned)
        } else {
            engine.store.get(key).and_then(|event| acts::target(&event))
        }
    });
    if let Some(id) = id {
        target(row, engine, &id);
    }
}
pub(super) fn profile(query: &super::Query, engine: &Engine) -> Vec<Value> {
    let Some(converted) = query.convert() else {
        return vec![];
    };
    let candidates = query::select(&engine.store, &converted, false)
        .into_iter()
        .filter(|event| {
            let chain = acts::resolve(&engine.store, event);
            chain.trusted(engine)
                && chain.note.as_ref().is_some_and(|note| {
                    [event, note].iter().all(|event| {
                        query::hidden_with_lists(
                            &engine.store,
                            &converted,
                            event,
                            &engine.private_lists,
                        )
                        .is_none()
                    })
                })
        })
        .collect();
    acts::representatives(&engine.store, candidates).into_iter().filter_map(|event| {
        let chain = acts::resolve(&engine.store,&event);
        let note = chain.note.as_ref()?;
        let model = rows::row_with_lists(&engine.store,note,query.account.as_deref(),0,&engine.private_lists);
        let mut value = super::note::note(&model,&engine.store,query.account.as_deref());
        value["at"] = json!(event.created_at.saturating_mul(1000));
        if let Some(own) = act_ref(engine,&event) { value["act"] = own; }
        if let Some(context) = chain.first.as_ref().and_then(|first| act_ref(engine,first)) {
            value["actOn"] = context;
        }
        if matches!(event.kind,6 | 16) {
            value["repostedBy"] = json!({"actors":[super::note::author(&rows::author(&engine.store,&event.pubkey))],
                "others":0,"at":event.created_at.saturating_mul(1000)});
        }
        super::quote_state::settle(&mut value,engine);
        Some(value)
    }).collect()
}

use super::*;
use crate::engine::{Engine, query, rows};
use serde_json::{Value, json};
impl Session {
    pub(super) fn source_rows(&self, sub: &str, e: &Engine) -> Vec<Value> {
        self.project_source(sub, e, true)
    }
    pub(super) fn notification_before(
        &self,
        sub: &str,
        e: &Engine,
        anchor: Option<&str>,
        before: usize,
    ) -> usize {
        let Some(anchor) = anchor else {
            return 0;
        };
        self.project_source(sub, e, false)
            .iter()
            .position(|r| r["key"].as_str() == Some(anchor))
            .map(|at| before.min(at))
            .unwrap_or(0)
    }
    pub(super) fn source_fresh(&self, sub: &str, e: &Engine) -> usize {
        let Some((Some(anchor), before, _)) = self.windows.get(sub) else {
            return 0;
        };
        self.project_source(sub, e, false)
            .iter()
            .position(|r| r["key"].as_str() == Some(anchor))
            .unwrap_or(0)
            .saturating_sub(*before)
    }
    pub(super) fn source_edges(&self, sub: &str, e: &Engine) -> (bool, bool) {
        let all = self.project_source(sub, e, false);
        let (start, end) = self
            .windows
            .get(sub)
            .map(|(anchor, before, after)| {
                let at = anchor
                    .as_ref()
                    .and_then(|key| all.iter().position(|r| r["key"].as_str() == Some(key)))
                    .unwrap_or(0);
                (at.saturating_sub(*before), at.saturating_add(*after))
            })
            .unwrap_or((0, 50));
        (
            start == 0,
            end >= all.len() && super::list_edges::settled(self.queries.get(sub), e),
        )
    }
    fn project_source(&self, sub: &str, e: &Engine, windowed: bool) -> Vec<Value> {
        let Some(q) = self.queries.get(sub) else {
            return vec![];
        };
        let store = &e.store;
        let weights =
            crate::engine::weights::Weights::new(store, &e.private_lists, q.account.as_deref());
        let converted = q.convert();
        let target = converted
            .as_ref()
            .and_then(|q| q.target.as_deref())
            .or(q.account.as_deref())
            .unwrap_or("");
        let thread = (q.source == "thread").then(|| super::thread::positions(store, target));
        let mut out=match q.source.as_str() {
            "people"=>super::people::people(e,q),
            "channels"=>super::channels::list(e,q),
            "following"=>store.follows(target).unwrap_or_default().iter().map(|p|person(e,p,q.account.as_deref(), weights.person(p))).collect(),
            "followers"=>store.feed(&crate::store::Query{kinds:vec![3],mention:Some(target.into()),limit:store.len(),..Default::default()})
                .iter().map(|v|person(e,&v.pubkey,q.account.as_deref(), weights.person(&v.pubkey))).collect(),
            "mutes"=>q.account.as_deref().and_then(|a|store.replaceable(a,10000)).map(|event|e.list_tags(&event).iter().filter_map(|tag|{
                let value=tag.get(1)?;let target=match tag.first()?.as_str(){"p"=>json!({"k":"person","pubkey":value}),"word"=>json!({"k":"word","word":value}),"t"=>json!({"k":"hashtag","tag":value}),"e"=>json!({"k":"thread","id":value}),_=>return None};
                let mut v=json!({"kind":"mute","key":format!("mute:{}:{value}",tag[0]),"target":target});if tag[0]=="p"{v["author"]=super::note::author(&rows::author(store,value));}Some(v)
            }).collect()).unwrap_or_default(),
            "relays"=>e.relay_rows(),
            "diagnostics"=>{
                let facts=json!({"events":store.len(),"eventPayloadBytes":store.payload_bytes(),"verified":e.verified,"rejected":e.rejected,"dropped":e.dropped,"persistenceQueue":e.pending.len(),"timings":e.metrics,"relayStatistics":e.network.stats(),"protocol":PROTOCOL_VERSION});
                facts.as_object().map(|m|m.iter().map(|(k,v)|json!({"kind":"info","key":k,"label":k,"value":v.to_string()})).collect()).unwrap_or_default()
            }
            "media-servers"=>q.account.as_deref().map(|a|e.upload_servers(a).into_iter().map(|url|e.server_row(&url)).collect()).unwrap_or_default(),
            "emoji"=>q.account.as_deref().and_then(|a|store.replaceable(a,10030)).map(|event|lkjstr_protocol::custom_emojis(&event).into_iter().map(|e|json!({"kind":"emoji","key":format!("emoji:{}",e.shortcode),"set":"","code":e.shortcode,"url":e.url})).collect()).unwrap_or_default(),
            "notifications"=>super::notifications::notifications(q,e),
            "bookmarks"=>converted.as_ref().map(|q|crate::engine::list_events::events(store,q,&e.private_lists).iter().map(|event|super::note::note(&rows::row_with_lists(store,event,q.account.as_deref(),0,&e.private_lists),store,q.account.as_deref())).collect()).unwrap_or_default(),
            "list"=>{
                q.convert().map(|converted|query::events(store,&converted).into_iter().next().map(|event|crate::engine::settings::list_tags_for(&event,&e.private_lists,q.account.as_deref()).iter().filter(|t|t.first().is_some_and(|k|k=="p")).filter_map(|t|t.get(1)).filter(|p|lkjstr_protocol::is_pubkey(p)).map(|p|person(e,p,q.account.as_deref(), weights.person(p))).collect()).unwrap_or_default()).unwrap_or_default()
            }
            _ => converted.as_ref().map(|converted| {
                query::events(store, converted).into_iter()
                    .filter(|event| query::hidden_with_lists(store, converted, event, &e.private_lists).is_none())
                    .filter_map(|event| {
                        let position = match &thread {
                            Some(positions) => Some(*positions.get(&event.id)?),
                            None => None,
                        };
                        let wrapper = event.kind == 6 || (q.source == "profile" && matches!(q.show.as_deref(), Some("reposts" | "reactions")));
                        let shown = if wrapper { lkjstr_protocol::tags::tag_values(&event, "e").last().and_then(|id| store.get(id))? } else { event.clone() };
                        let row = rows::row_with_lists(store, &shown, q.account.as_deref(), 0, &e.private_lists);
                        let mut value = super::note::note(&row, store, q.account.as_deref());
                        if wrapper && q.show.as_deref() == Some("reposts") {
                            value["repostedBy"] = json!({"actors":[super::note::author(&rows::author(store,&event.pubkey))],"others":0,"at":event.created_at.saturating_mul(1000)});
                        }
                        if let Some((role, depth)) = position {
                            value["thread"] = json!({"role":role,"depth":depth});
                        }
                        super::quote_state::settle(&mut value,e);
                        Some(value)
                    }).collect()
            }).unwrap_or_default(),
        };
        if q.notifications == Some(true)
            && matches!(q.source.as_str(), "home" | "global" | "their-home")
        {
            // Render ordinary timeline notes, then insert the identical notification rows.
            let mut plain = q.clone();
            plain.notifications = None;
            if let Some(converted) = plain.convert() {
                let ids: std::collections::HashSet<_> = query::events(store, &converted)
                    .iter()
                    .map(|e| e.id.clone())
                    .collect();
                out.retain(|r| r["id"].as_str().is_some_and(|id| ids.contains(id)));
            }
            let mut news = q.clone();
            news.source = "notifications".into();
            news.notifications = None;
            for row in super::notifications::notifications(&news, e) {
                if row["note"]["id"].is_string() && out.iter().any(|r| r["id"] == row["note"]["id"])
                {
                    continue;
                }
                out.push(row);
            }
            out.sort_by(|a, b| b["at"].as_u64().cmp(&a["at"].as_u64()));
        }
        for row in &mut out {
            if row["id"]
                .as_str()
                .is_some_and(|id| e.network.pending_event(id))
            {
                row["pending"] = json!(true);
            }
        }
        let mut keys = std::collections::HashSet::new();
        out.retain(|r| keys.insert(r["key"].clone().to_string()));
        if q.source == "channel"
            && !target.is_empty()
            && let Some(row) = super::channels::row(
                e,
                target,
                q.account.as_deref(),
                &converted
                    .as_ref()
                    .map(|q| q.filters.relay_hints.clone())
                    .unwrap_or_default(),
            )
        {
            out.insert(0, row);
        }
        if q.source == "profile" {
            out.insert(0, profile(e, target, q.account.as_deref()));
        }
        if !windowed {
            return out;
        }
        if let Some((anchor, before, after)) = self.windows.get(sub) {
            let at = anchor
                .as_ref()
                .and_then(|key| out.iter().position(|r| r["key"].as_str() == Some(key)))
                .unwrap_or(0);
            let start = at.saturating_sub(*before);
            let end = at.saturating_add(*after).min(out.len());
            out = out[start.min(end)..end].to_vec();
        } else {
            out.truncate(50);
        }
        out
    }
}
pub(super) fn person(e: &Engine, p: &str, account: Option<&str>, weight: u64) -> Value {
    let store = &e.store;
    json!({"kind":"person","key":p,"weight":weight,"author":super::note::author(&rows::author(store,p)),
        "about":store.profile(p).map(|p|p.about.lines().next().unwrap_or("").chars().take(160).collect::<String>()).unwrap_or_default(),
        "followed":account.and_then(|a|store.follows(a)).is_some_and(|f|f.iter().any(|key|key==p)),"followsYou":store.follows(p).is_some_and(|f|account.is_some_and(|a|f.iter().any(|key|key==a))),"self":account==Some(p)})
}
fn profile(e: &Engine, p: &str, account: Option<&str>) -> Value {
    let store = &e.store;
    let a = rows::author(store, p);
    let mut result = person(
        e,
        p,
        account,
        crate::engine::weights::Weights::new(store, &e.private_lists, account).person(p),
    );
    result["kind"] = json!("profile");
    result["key"] = json!(format!("profile:{p}"));
    let meta = store.profile(p).unwrap_or_default();
    let segments = crate::content::segments(&meta.about, &[])
        .into_iter()
        .map(|s| match s {
            crate::content::Segment::Text(text) => json!({"k":"text","text":text}),
            crate::content::Segment::Link(url) => json!({"k":"link","text":url,"url":url}),
            _ => json!({"k":"text","text":""}),
        })
        .collect::<Vec<_>>();
    result["about"] = json!(segments);
    result["banner"] = json!(meta.banner);
    result["website"] = json!(meta.website);
    result["lud16"] = json!(meta.lud16);
    super::counts::profile(&mut result, e, p);

    result["muted"] = json!(crate::engine::settings::list_has(
        store,
        &e.private_lists,
        account,
        10000,
        "p",
        p
    ));
    result["relays"] = json!(
        store
            .relay_list(p)
            .unwrap_or_default()
            .into_iter()
            .filter(|(_, _, w)| *w)
            .map(|(url, _, _)| url)
            .collect::<Vec<_>>()
    );
    result["author"] = super::note::author(&a);
    result
}

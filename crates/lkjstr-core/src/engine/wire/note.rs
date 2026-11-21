use crate::{
    engine::rows::{Author, Row, Segment},
    store::Store,
};
use serde_json::{Value, json};
pub fn author(a: &Author) -> Value {
    let npub = lkjstr_protocol::encode_npub(&a.pubkey).unwrap_or_else(|_| a.pubkey.clone());
    let emoji = a
        .name_segments
        .iter()
        .filter_map(|p| match p {
            crate::engine::rows::NameSegment::Emoji { code, url } => {
                Some(json!({"code":code,"url":url}))
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    let mut value = json!({"pubkey":a.pubkey,"npub":npub,"name":a.name,"verified":a.nip05_verified,"emoji":emoji});
    if let Some(id) = &a.profile_id {
        value["profileId"] = json!(id);
    }
    if let Some(p) = &a.picture {
        value["picture"] = json!(p);
    }
    if let Some(n) = &a.nip05 {
        value["nip05"] = json!(n.strip_prefix("_@").unwrap_or(n));
    }
    value
}
fn parts(row: &Row) -> (Vec<Value>, Vec<Value>, Vec<Value>) {
    let mut segments = Vec::new();
    let mut media = Vec::new();
    let mut quotes = Vec::new();
    for s in &row.content {
        match s {
            Segment::Text { text } => segments.push(json!({"k":"text","text":text})),
            Segment::Link { url } => segments.push(json!({"k":"link","url":url,"text":url})),
            Segment::Hashtag { tag } => segments.push(json!({"k":"hashtag","tag":tag})),
            Segment::Mention { author: a } => {
                let name = if a.name == a.pubkey {
                    lkjstr_protocol::encode_npub(&a.pubkey).unwrap_or_default()
                } else {
                    a.name.clone()
                };
                segments.push(json!({"k":"mention","pubkey":a.pubkey,"name":name}))
            }
            Segment::Emoji { code, url } => {
                segments.push(json!({"k":"emoji","code":code,"url":url}))
            }
            Segment::Media {
                url,
                kind,
                width,
                height,
                alt,
            } => {
                let mut m = json!({"url":url,"type":kind});
                if let Some(w) = width {
                    m["w"] = json!(w);
                }
                if let Some(h) = height {
                    m["h"] = json!(h);
                }
                if let Some(alt) = alt {
                    m["alt"] = json!(alt);
                }
                media.push(m);
            }
            Segment::Quote { id, row } => {
                quotes.push(if let Some(row)=row{let (s,m,_)=parts(row);let mut q=json!({"state":if row.own.muted{"muted"}else{"ok"},"id":id,"author":author(&row.author),"at":row.created_at.saturating_mul(1000),"segments":s,"media":m});if let Some(cw)=&row.warning{q["cw"]=json!(cw);}q}else{json!({"state":"loading","id":id})});
            }
        }
    }
    (segments, media, quotes)
}
pub(super) fn note(row: &Row, store: &Store, account: Option<&str>) -> Value {
    let (segments, media, quotes) = parts(row);
    let mut v = json!({"kind":"note","key":row.id,"id":row.id,"bech32":lkjstr_protocol::encode_note(&row.id).unwrap_or_else(|_|row.id.clone()),
        "author":author(&row.author),"at":row.created_at.saturating_mul(1000),"segments":segments,"media":media,"quotes":quotes,
        "counts":super::counts::note(row,store),
        "reactions":row.reactions.iter().map(|r|{let mut v=json!({"emoji":r.content,"count":r.count,"mine":r.mine});if let Some(url)=&r.url{v["url"]=json!(url);}v}).collect::<Vec<_>>(),
        "mine":{"reposted":row.own.reposted,"bookmarked":row.own.bookmarked,"own":Some(row.author.pubkey.as_str())==account}});
    if let Some(event) = store.get(&row.id) {
        if let Some(id) = lkjstr_protocol::channel_id(&event) {
            v["channel"] = json!({"id":id,"name":crate::engine::channels::metadata(store,&id).0["name"].as_str().unwrap_or("")});
        }
        if let Some(client) = lkjstr_protocol::first_tag_value(&event, "client") {
            v["client"] = json!(client);
        }
    }
    if let Some(cw) = &row.warning {
        v["cw"] = json!(cw);
    }
    if let Some(reason) = &row.hidden_reason {
        v["hidden"] = json!({"reason":reason});
    }
    if let Some(parent) = row.reply.as_ref().and_then(|p| store.get(&p.id)) {
        v["replyTo"] = json!({"id":parent.id,"author":author(&crate::engine::rows::author(store,&parent.pubkey)),"excerpt":parent.content.lines().next().unwrap_or("").chars().take(160).collect::<String>()});
    }
    if !row.reposts.is_empty() {
        let at = row.reposted_at.unwrap_or(row.created_at);
        v["repostedBy"] = json!({"actors":row.reposts.iter().take(3).map(author).collect::<Vec<_>>(),"others":row.reposts.len().saturating_sub(3),"at":at.saturating_mul(1000)});
    }
    v
}

//! Relay usage is independent from observed transport state; retain 64 known URLs.
use super::{Engine, wire::RelayConfig};
use serde_json::{Value, json};
pub fn strict_relay(url: &str) -> Option<String> {
    let u = url::Url::parse(url).ok()?;
    if !matches!(u.scheme(), "ws" | "wss")
        || u.host_str().is_none()
        || !u.username().is_empty()
        || u.password().is_some()
        || u.fragment().is_some()
        || u.query().is_some()
    {
        return None;
    }
    lkjstr_protocol::normalize_relay_url(url)
}
pub fn valid_server(url: &str) -> bool {
    url::Url::parse(url).is_ok_and(|u| {
        u.scheme() == "https"
            && u.host_str().is_some()
            && u.username().is_empty()
            && u.password().is_none()
            && u.fragment().is_none()
    })
}
impl Engine {
    pub fn list_tags(&self, event: &lkjstr_protocol::NostrEvent) -> Vec<Vec<String>> {
        list_tags(event, &self.private_lists)
    }

    pub fn refuse_sign(&mut self, req: String, code: &str) {
        if self.signing.remove(&req).is_some() {
            self.error(Some(req), code);
        }
    }
    pub fn invalidate(&mut self) {
        for v in self.views.values_mut() {
            v.dirty = true;
        }
    }
    pub fn configure_relays(
        &mut self,
        entries: Vec<RelayConfig>,
        now: u64,
    ) -> Result<(), &'static str> {
        if entries.len() > 8 {
            return Err("invalid-relay");
        }
        let entries = entries
            .into_iter()
            .map(|mut r| {
                r.url = strict_relay(&r.url).ok_or("invalid-relay")?;
                Ok(r)
            })
            .collect::<Result<Vec<_>, &'static str>>()?;
        self.network.configure(
            entries
                .iter()
                .filter(|r| r.read || r.write)
                .map(|r| r.url.clone())
                .collect(),
            now,
        );
        for r in self.network.known.values_mut() {
            r.read = false;
            r.write = false;
            r.search = false;
        }
        for r in entries {
            if !self.network.known.contains_key(&r.url) && self.network.known.len() >= 64 {
                let unused = self
                    .network
                    .known
                    .iter()
                    .find(|(_, r)| !r.read && !r.write && !r.search)
                    .map(|(u, _)| u.clone());
                if let Some(u) = unused {
                    self.network.known.remove(&u);
                }
            }
            self.network.known.insert(r.url.clone(), r);
        }
        self.invalidate();
        self.replan(now);
        Ok(())
    }
    pub fn relay_rows(&self) -> Vec<Value> {
        let mut rows:Vec<_>=self.network.known.values().map(|r| {
            let stats=self.network.stats();
            let stat=stats.as_array().and_then(|a|a.iter().find(|v|v["url"]==r.url));
            let relay=self.network.relays.get(&r.url);
            let subs=stat.and_then(|s|s["activeReqs"].as_u64()).unwrap_or(0);
            let mut row=json!({"kind":"relay","key":r.url,"url":r.url,"state":match relay {Some(s) if s.online=>"connected",Some(s) if s.connecting=>"connecting",Some(s) if s.failures>0=>"waiting",_=>"idle"},"inUse":subs>0,"why":if r.read||r.write {"yours"}else if r.search{"search"}else{"unused"},"read":r.read,"write":r.write,"subs":subs,"events":relay.map(|r|r.received).unwrap_or(0)});
            if let Some(ms)=relay.and_then(|r|r.latency_ms) { row["latencyMs"]=json!(ms); }
            row
        }).collect();
        rows.sort_by_key(|r| {
            self.network
                .relay_order
                .iter()
                .position(|u| r["url"] == *u)
                .unwrap_or(usize::MAX)
        });
        rows
    }
}

/// At most 128 decrypted lists, supplied by the account host; keyed by signed ID.
pub type PrivateLists = std::collections::BTreeMap<String, Vec<Vec<String>>>;
pub fn list_tags(event: &lkjstr_protocol::NostrEvent, private: &PrivateLists) -> Vec<Vec<String>> {
    let mut tags = event.tags.clone();
    if let Some(entries) = private.get(&event.id) {
        tags.extend(entries.clone());
    }
    tags
}
pub fn list_has(
    store: &crate::store::Store,
    private: &PrivateLists,
    account: Option<&str>,
    kind: u64,
    tag: &str,
    value: &str,
) -> bool {
    account
        .and_then(|a| store.replaceable(a, kind))
        .is_some_and(|e| {
            list_tags(&e, private).iter().any(|t| {
                t.first().is_some_and(|t| t == tag) && t.get(1).is_some_and(|t| t == value)
            })
        })
}

//! Relay display and redaction for Stats, with transport counters at their source.
use super::*;
use std::net::Ipv4Addr;
use url::{Host, Url};

pub(in crate::engine) fn relay_url(raw: &str) -> Option<Url> {
    let mut url = Url::parse(raw).ok()?;
    if !matches!(url.scheme(), "ws" | "wss") || !url.has_host() {
        return None;
    }
    url.set_username("").ok()?;
    url.set_password(None).ok()?;
    url.set_query(None);
    url.set_fragment(None);
    Some(url)
}

fn origin(url: &Url) -> String {
    url.origin().ascii_serialization()
}

fn private_host(host: Option<Host<&str>>) -> bool {
    match host {
        Some(Host::Ipv4(ip)) => private_v4(ip),
        Some(Host::Ipv6(ip)) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.to_ipv4_mapped().is_some_and(private_v4)
        }
        Some(Host::Domain(name)) => {
            let name = name.trim_end_matches('.');
            name == "localhost"
                || name.ends_with(".localhost")
                || name.ends_with(".local")
                || name.ends_with(".onion")
                || [".lan", ".home", ".internal"]
                    .iter()
                    .any(|suffix| name.ends_with(suffix))
        }
        None => true,
    }
}

fn private_v4(ip: Ipv4Addr) -> bool {
    ip.is_loopback() || ip.is_private() || ip.is_link_local() || ip.is_unspecified()
}

/// Relay responses can echo arbitrary event fields or credentials.
pub(in crate::engine) fn relay_error(value: &str) -> &'static str {
    match value {
        "connection-lost" => "connection-lost",
        "read-timeout" => "read-timeout",
        "rate-limited: cooldown" => "rate-limited: cooldown",
        "capacity" => "capacity",
        _ if value.starts_with("auth-required:") => "auth-required",
        _ => "relay-error",
    }
}

impl Network {
    pub(super) fn send(&mut self, relay: &str, value: Value) {
        let text = value.to_string();
        if let Some(r) = self.relays.get_mut(relay) {
            r.sent += 1;
            r.bytes_out += text.len() as u64;
        }
        self.effects.push(Effect::Send(relay.into(), text));
    }

    pub(in crate::engine) fn mark_auth_required(&mut self, relay: &str) {
        if let Some(state) = self.relays.get_mut(relay) {
            state.auth_required = true;
        }
        let Some(url) = relay_url(relay) else { return };
        let label = origin(&url);
        self.auth_origins.retain(|old| old != &label);
        if self.auth_origins.len() == 256 {
            self.auth_origins.pop_front();
        }
        self.auth_origins.push_back(label);
    }

    pub(in crate::engine) fn relay_display(&self, relay: &str) -> String {
        relay_url(relay).map_or_else(|| "private-relay".into(), Url::into)
    }

    pub(super) fn stats_relay_label(&self, relay: &str) -> String {
        let Some(url) = relay_url(relay) else {
            return "private-relay".into();
        };
        if self.relays.get(relay).is_some_and(|r| r.auth_required)
            || private_host(url.host())
            || (!self.auth_origins.is_empty() && self.auth_origins.contains(&origin(&url)))
        {
            "private-relay".into()
        } else {
            url.into()
        }
    }
}

pub(in crate::engine) fn publication_kind_is_public(kind: u64) -> bool {
    crate::optimizer::retention::public_kind(kind)
}

pub(super) fn public_filter(filter: &NostrFilter) -> bool {
    filter.kinds.as_ref().is_some_and(|kinds| {
        !kinds.is_empty() && kinds.iter().all(|&kind| publication_kind_is_public(kind))
    })
}

impl Request {
    pub(super) fn visible_in_stats(&self) -> bool {
        !self.members.iter().any(|member| member.starts_with("~dm"))
            && self.filter.kinds.as_ref().is_none_or(|kinds| {
                !kinds
                    .iter()
                    .any(|kind| matches!(kind, 4 | 13 | 14 | 1059 | 10050))
            })
    }
}

#[cfg(test)]
mod tests {
    use super::Network;

    #[test]
    fn private_host_covers_address_ranges_and_suffixes() {
        let network = Network::default();
        for host in [
            "localhost.",
            "sub.localhost",
            "127.8.9.10",
            "[::1]",
            "10.0.0.2",
            "172.31.2.3",
            "192.168.0.2",
            "169.254.0.9",
            "[fe80::1]",
            "[::ffff:192.168.0.2]",
            "lan.local.",
            "something.onion",
        ] {
            assert!(
                network.stats_relay_label(&format!("wss://{host}/")) == "private-relay",
                "{host}"
            );
        }
        for host in [
            "8.8.8.8",
            "172.32.2.3",
            "localhost.example",
            "onion.example",
        ] {
            assert!(
                network.stats_relay_label(&format!("wss://{host}/")) != "private-relay",
                "{host}"
            );
        }
    }
}

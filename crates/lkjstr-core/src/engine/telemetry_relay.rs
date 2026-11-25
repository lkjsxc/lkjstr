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

pub(super) fn origin(url: &Url) -> String {
    url.origin().ascii_serialization()
}

pub(super) fn private_host(host: Option<Host<&str>>) -> bool {
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

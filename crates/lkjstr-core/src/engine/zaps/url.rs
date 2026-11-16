//! Restrict automatic provider fetches to bounded HTTPS public hosts.
use super::{Failure, Result};
use std::net::{Ipv4Addr, Ipv6Addr};
use url::{Host, Url};

pub(super) fn https(value: &str) -> Result<Url> {
    if value.len() > 2048 {
        return Err(Failure::TooLarge);
    }
    let url = Url::parse(value).map_err(|_| Failure::Rejected)?;
    if url.scheme() != "https" {
        return Err(Failure::Unsupported);
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.port().is_some_and(|p| p != 443)
    {
        return Err(Failure::Rejected);
    }
    match url.host().ok_or(Failure::Rejected)? {
        Host::Domain(host) => {
            let host = host.trim_end_matches('.').to_ascii_lowercase();
            if !host.contains('.')
                || host == "localhost"
                || [".localhost", ".local", ".internal", ".onion"]
                    .iter()
                    .any(|suffix| host.ends_with(suffix))
            {
                return Err(Failure::Unsupported);
            }
        }
        Host::Ipv4(ip) if !public_v4(ip) => return Err(Failure::Unsupported),
        Host::Ipv6(ip) if !public_v6(ip) => return Err(Failure::Unsupported),
        _ => {}
    }
    Ok(url)
}
fn public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, _, _] = ip.octets();
    !(ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
        || a == 0
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 198 && matches!(b, 18 | 19)))
}
fn public_v6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return public_v4(v4);
    }
    let first = ip.segments()[0];
    first & 0xe000 == 0x2000
        && !ip.is_loopback()
        && !ip.is_unspecified()
        && !(first == 0x2001 && ip.segments()[1] == 0x0db8)
}

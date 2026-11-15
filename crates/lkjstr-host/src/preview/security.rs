//! Resolve every hop once, reject mixed answers, and pin the checked socket addresses.
use std::net::{IpAddr, SocketAddr};
use url::Url;
pub fn target(raw: &str) -> Result<Url, ()> {
    if raw.len() > 4096 {
        return Err(());
    }
    let mut u = Url::parse(raw).map_err(|_| ())?;
    if !matches!(u.scheme(), "http" | "https")
        || !matches!(u.port_or_known_default(), Some(80 | 443))
        || !u.username().is_empty()
        || u.password().is_some()
        || u.host_str().is_none()
    {
        return Err(());
    }
    u.set_fragment(None);
    if let Some(ip) = u
        .host_str()
        .and_then(|h| h.trim_matches(['[', ']']).parse::<IpAddr>().ok())
        && !public(ip)
    {
        return Err(());
    }
    Ok(u)
}
pub fn public(ip: IpAddr) -> bool {
    let ranges = match ip {
        IpAddr::V4(_) => &[
            "0.0.0.0/8",
            "10.0.0.0/8",
            "100.64.0.0/10",
            "127.0.0.0/8",
            "169.254.0.0/16",
            "172.16.0.0/12",
            "192.0.0.0/24",
            "192.0.2.0/24",
            "192.88.99.0/24",
            "192.168.0.0/16",
            "198.18.0.0/15",
            "198.51.100.0/24",
            "203.0.113.0/24",
            "224.0.0.0/4",
            "240.0.0.0/4",
        ][..],
        IpAddr::V6(v) => {
            // Permit global unicast only. This also rejects mapped IPv4, ULA, NAT64 and multicast.
            if v.segments()[0] & 0xe000 != 0x2000 {
                return false;
            }
            &["2001::/23", "2001:db8::/32", "2002::/16", "3fff::/20"][..]
        }
    };
    !ranges
        .iter()
        .any(|r| r.parse::<ipnet::IpNet>().is_ok_and(|n| n.contains(&ip)))
}
pub async fn resolve(u: &Url) -> Result<Vec<SocketAddr>, ()> {
    let host = u.host_str().ok_or(())?.trim_matches(['[', ']']);
    let port = u.port_or_known_default().ok_or(())?;
    let addrs = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| ())?
        .collect::<Vec<_>>();
    checked(&addrs)?;
    Ok(addrs)
}
pub fn checked(addrs: &[SocketAddr]) -> Result<(), ()> {
    if addrs.is_empty() || addrs.iter().any(|a| !public(a.ip())) {
        Err(())
    } else {
        Ok(())
    }
}

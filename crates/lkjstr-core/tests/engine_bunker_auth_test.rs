use lkjstr_core::engine::bunker::*;
use lkjstr_protocol::remote::AuthUrl;
use std::collections::{BTreeMap, BTreeSet};
type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;
fn authority() -> Authority {
    Authority {
        generation: 1,
        peer: "a".repeat(64),
        client: "b".repeat(64),
    }
}
fn owner(client: u64) -> Owner {
    Owner {
        client,
        account: Some(("c".repeat(64), authority())),
        request: Some("action".into()),
    }
}
fn start(client: u64) -> Start {
    Start {
        owner: owner(client),
        method: Method::Sign,
        peer: "a".repeat(64),
        expires_at: 60_001,
    }
}
fn context<'a>(
    clients: &'a BTreeSet<u64>,
    accounts: &'a BTreeMap<String, Authority>,
) -> Context<'a> {
    Context { clients, accounts }
}
#[test]
fn keeps_original_deadline_and_deduplicates_challenges() -> Result {
    let mut book = Book::default();
    let clients = BTreeSet::from([1]);
    let accounts = BTreeMap::from([("c".repeat(64), authority())]);
    let lease = book.start(start(1), 1, &context(&clients, &accounts))?;
    let url = AuthUrl::parse("https://signer.test/auth?token=private").ok_or("fixture URL")?;
    assert!(book.challenge(lease, &url, 2)?);
    assert!(!book.challenge(lease, &url, 45_000)?);
    assert_eq!(book.get(lease).map(|t| t.expires_at), Some(60_001));
    assert_eq!(book.challenge(lease, &url, 60_001), Err("signer-timeout"));
    let removed = book.sync(&context(&clients, &accounts), 60_001);
    assert_eq!(removed.len(), 1);
    assert_eq!(removed[0].reason, Reason::Expired);
    assert!(removed[0].shown);
    assert!(book.is_empty());
    Ok(())
}
#[test]
fn cancel_requires_the_original_client_and_clears_once() -> Result {
    let mut book = Book::default();
    let clients = BTreeSet::from([1, 2]);
    let accounts = BTreeMap::from([("c".repeat(64), authority())]);
    let lease = book.start(start(1), 1, &context(&clients, &accounts))?;
    let url = AuthUrl::parse("https://signer.test/auth").ok_or("fixture URL")?;
    book.challenge(lease, &url, 2)?;
    assert!(book.cancel(2, lease, false).is_none());
    let removed = book.cancel(1, lease, true).ok_or("owned cancel")?;
    assert_eq!(removed.reason, Reason::Unsupported);
    assert!(removed.shown);
    assert!(book.cancel(1, lease, false).is_none());
    assert_eq!(book.challenge(lease, &url, 3), Err("offline"));
    Ok(())
}
#[test]
fn authority_replacement_detach_and_request_replacement_revoke() -> Result {
    let mut book = Book::default();
    let mut clients = BTreeSet::from([1, 2]);
    let mut accounts = BTreeMap::from([("c".repeat(64), authority())]);
    let first = book.start(start(1), 1, &context(&clients, &accounts))?;
    let other = book.start(start(2), 1, &context(&clients, &accounts))?;
    assert_eq!(book.replace(1, "action").len(), 1);
    assert!(book.get(first).is_none());
    assert!(book.get(other).is_some());
    let second = book.start(start(1), 2, &context(&clients, &accounts))?;
    assert_ne!(first, second);
    clients.remove(&1);
    assert_eq!(book.sync(&context(&clients, &accounts), 3).len(), 1);
    assert!(book.get(other).is_some());
    accounts
        .get_mut(&"c".repeat(64))
        .ok_or("account")?
        .generation += 1;
    assert_eq!(book.sync(&context(&clients, &accounts), 4).len(), 1);
    assert!(book.is_empty());
    Ok(())
}
#[test]
fn discovery_has_client_ownership_before_account_is_known() -> Result {
    let mut book = Book::default();
    let mut clients = BTreeSet::from([1]);
    let accounts = BTreeMap::new();
    let mut request = start(1);
    request.owner.account = None;
    request.method = Method::Connect;
    let lease = book.start(request, 1, &context(&clients, &accounts))?;
    assert!(book.get(lease).is_some());
    clients.clear();
    assert_eq!(book.sync(&context(&clients, &accounts), 2).len(), 1);
    Ok(())
}
#[test]
fn caps_updates_without_allowing_url_floods_or_deadline_refresh() -> Result {
    let mut book = Book::default();
    let clients = BTreeSet::from([1]);
    let accounts = BTreeMap::from([("c".repeat(64), authority())]);
    let lease = book.start(start(1), 1, &context(&clients, &accounts))?;
    for i in 0..MAX_CHANGES {
        let url =
            AuthUrl::parse(&format!("https://signer.test/auth?step={i}")).ok_or("fixture URL")?;
        assert!(book.challenge(lease, &url, 2)?);
        assert!(!book.challenge(lease, &url, 3)?);
    }
    let extra = AuthUrl::parse("https://signer.test/auth?step=extra").ok_or("fixture URL")?;
    assert_eq!(book.challenge(lease, &extra, 4), Err("too-large"));
    assert_eq!(book.get(lease).map(|t| t.expires_at), Some(60_001));
    let repeated = AuthUrl::parse("https://signer.test/auth?step=0").ok_or("fixture URL")?;
    assert!(!book.challenge(lease, &repeated, 5)?);
    assert_eq!(
        book.get(lease).and_then(|t| t.url()),
        Some("https://signer.test/auth?step=3")
    );
    Ok(())
}
#[test]
fn caps_pending_jobs_and_never_reuses_cleared_tokens() -> Result {
    let mut book = Book::default();
    let clients = BTreeSet::from([1, 2, 3, 4, 5]);
    let accounts = BTreeMap::from([("c".repeat(64), authority())]);
    let mut first = None;
    for client in 1..=4 {
        for _ in 0..MAX_PER_CLIENT {
            let lease = book.start(start(client), 1, &context(&clients, &accounts))?;
            first.get_or_insert(lease);
        }
        assert_eq!(
            book.start(start(client), 1, &context(&clients, &accounts))
                .err(),
            Some("too-large")
        );
    }
    assert_eq!(book.len(), MAX_PENDING);
    assert_eq!(
        book.start(start(5), 1, &context(&clients, &accounts)).err(),
        Some("too-large")
    );
    assert_eq!(book.clear().len(), MAX_PENDING);
    let next = book.start(start(1), 2, &context(&clients, &accounts))?;
    assert!(Some(next) > first);
    Ok(())
}

#[test]
fn only_discovery_can_start_without_an_account_authority() -> Result {
    let mut book = Book::default();
    let clients = BTreeSet::from([1]);
    let accounts = BTreeMap::new();
    for method in [
        Method::Sign,
        Method::Encrypt44,
        Method::Decrypt44,
        Method::Decrypt04,
    ] {
        let mut request = start(1);
        request.owner.account = None;
        request.method = method;
        assert_eq!(
            book.start(request, 1, &context(&clients, &accounts)).err(),
            Some("signed-out")
        );
    }
    Ok(())
}

#[test]
fn parent_deadline_can_shorten_but_never_extend_the_rpc_budget() -> Result {
    let mut book = Book::default();
    let clients = BTreeSet::from([1]);
    let accounts = BTreeMap::from([("c".repeat(64), authority())]);
    let mut short = start(1);
    short.expires_at = 12001;
    let lease = book.start(short, 1, &context(&clients, &accounts))?;
    assert_eq!(book.get(lease).map(|t| t.expires_at), Some(12001));
    let mut long = start(1);
    long.expires_at = u64::MAX;
    let lease = book.start(long, 1, &context(&clients, &accounts))?;
    assert_eq!(book.get(lease).map(|t| t.expires_at), Some(60001));
    Ok(())
}

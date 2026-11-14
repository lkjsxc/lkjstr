use lkjstr_core::{
    actions::validate_signed_event, persistence::PendingEvents, prefetch, store::Store,
};
use lkjstr_protocol::{
    EventPointer, EventTemplate, NostrEvent, UnsignedNostrEvent, encode_nevent, encode_note,
    finalize_event, generate_secret_key,
};
use std::sync::Arc;

fn event() -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 10,
            kind: 3,
            tags: vec![vec!["p".into(), "a".repeat(64)]],
            content: "contacts".into(),
        },
        &generate_secret_key(),
    )
    .unwrap_or_else(|_| unreachable!("valid test fixture"))
}

#[test]
fn external_signer_must_preserve_every_unsigned_field_and_verify() {
    let key = generate_secret_key();
    let source = event();
    let template = EventTemplate {
        pubkey: None,
        created_at: source.created_at,
        kind: source.kind,
        tags: source.tags,
        content: source.content,
    };
    let sign = |template: &EventTemplate| {
        finalize_event(template, &key).unwrap_or_else(|_| unreachable!("valid signed fixture"))
    };
    let good = sign(&template);
    let requested = UnsignedNostrEvent {
        pubkey: good.pubkey.clone(),
        created_at: good.created_at,
        kind: good.kind,
        tags: good.tags.clone(),
        content: good.content.clone(),
    };
    assert!(validate_signed_event(&requested, &good).is_ok());
    let mut changed = vec![template.clone(); 4];
    changed[0].created_at += 1;
    changed[1].kind = 1;
    changed[2].tags.push(vec!["p".into(), "b".repeat(64)]);
    changed[3].content.push('!');
    for template in changed {
        // Each substituted payload has a valid ID and signature of its own.
        assert!(validate_signed_event(&requested, &sign(&template)).is_err());
    }
    let mut bad_id = good.clone();
    bad_id.id = "0".repeat(64);
    let mut bad_sig = good.clone();
    bad_sig.sig = "0".repeat(128);
    for bad in [bad_id, bad_sig] {
        assert!(validate_signed_event(&requested, &bad).is_err());
    }
    let other_account = event();
    assert!(validate_signed_event(&requested, &other_account).is_err());
}

#[test]
fn failed_batches_survive_retry_and_concurrent_arrivals() {
    let a = event();
    let b = event();
    let mut queue = PendingEvents::default();
    queue.push(a.clone(), true);
    let failed = queue.batch();
    queue.push(b.clone(), true);
    assert_eq!(queue.batch(), vec![a.clone(), b.clone()]);
    queue.committed(&failed);
    assert_eq!(queue.batch(), vec![b]);
    let retry = queue.batch();
    queue.committed(&retry);
    assert!(queue.is_empty());
}

#[test]
fn unavailable_storage_buffers_nothing_and_repeated_failures_stay_bounded() {
    let mut queue = PendingEvents::default();
    let mut e = event();
    for n in 0..20_100 {
        e.id = format!("{n:064x}");
        queue.push(e.clone(), false);
    }
    assert_eq!(queue.len(), 0);
    for n in 0..20_100 {
        e.id = format!("{n:064x}");
        queue.push(e.clone(), true);
    }
    assert_eq!(queue.len(), 20_000);
    assert_eq!(queue.batch().len(), 500);
    assert_eq!(queue.batch()[0].id, format!("{:064x}", 100));
}

#[test]
fn quotes_and_mention_edges_are_not_conversation_replies() {
    let mut store = Store::new(100);
    let mut root = event();
    root.kind = 1;
    root.tags.clear();
    let mut quote = event();
    quote.kind = 1;
    quote.tags = vec![vec!["q".into(), root.id.clone()]];
    let mut mention = event();
    mention.kind = 1;
    mention.tags = vec![
        vec!["e".into(), root.id.clone(), "".into(), "mention".into()],
        vec!["e".into(), quote.id.clone(), "".into(), "reply".into()],
    ];
    for e in [&root, &quote, &mention] {
        store.insert(e.clone(), None);
    }
    for kind in [6, 7] {
        let mut action = event();
        action.kind = kind;
        action.tags = vec![
            vec!["q".into(), root.id.clone()],
            vec!["e".into(), quote.id.clone()],
        ];
        store.insert(action, None);
    }
    assert_eq!(store.thread(&root.id).len(), 1);
    assert_eq!(store.counts(&root.id), (0, 0, 0));
    assert_eq!(
        store.counts(&quote.id),
        (1, 1, 1),
        "only actual action targets count"
    );
    assert_eq!(
        store.referencing(&root.id).len(),
        4,
        "generic references still include quotes"
    );
}

#[test]
fn rendered_content_pointers_prefetch_targets_and_relay_hints_without_q_tags() {
    let id = "a".repeat(64);
    let other = "b".repeat(64);
    let note = encode_note(&id).unwrap_or_else(|_| unreachable!("valid test fixture"));
    let pointer = encode_nevent(&EventPointer {
        id: other.clone(),
        relays: Some(vec!["wss://quote.example/".into()]),
        author: None,
        kind: None,
    })
    .unwrap_or_else(|_| unreachable!("valid test fixture"));
    let mut e = event();
    e.kind = 1;
    e.tags.clear();
    e.content = format!("nostr:{note} nostr:{pointer} nostr:{note}");
    let mut store = Store::new(100);
    store.insert(e.clone(), Some("wss://cached-feed.example/"));
    let refs = prefetch::collect(&[Arc::new(e.clone())], &store);
    assert_eq!(refs.notes, vec![id, other]);
    assert_eq!(refs.relays, vec!["wss://quote.example/"]);
    assert_eq!(refs.deletions, vec![e.id]);
    assert!(
        refs.deletion_relays
            .contains(&"wss://cached-feed.example/".into())
    );
    assert!(
        !refs.relays.contains(&"wss://cached-feed.example/".into()),
        "feed relays must not crowd out explicit quote lookup hints"
    );
}

use lkjstr_protocol::{
    KIND_ZAP_RECEIPT, NostrEvent, ZapReceiptGroup, ZapTarget, group_zap_receipts,
    split_zap_amounts, zap_receipt_amount_msats, zap_target_event_id, zap_targets,
};

#[test]
fn calculates_weighted_zap_targets_and_amounts() {
    let event = event_with_tags(vec![
        tag(&["zap", &"1".repeat(64), "wss://one", "1"]),
        tag(&["zap", &"2".repeat(64), "wss://two", "3"]),
        tag(&["zap", &"3".repeat(64), "wss://three"]),
    ]);
    let targets = zap_targets(&event, None);
    assert_eq!(
        targets,
        vec![
            ZapTarget {
                pubkey: "1".repeat(64),
                relays: vec!["wss://one".to_owned()],
                weight: 1.0,
            },
            ZapTarget {
                pubkey: "2".repeat(64),
                relays: vec!["wss://two".to_owned()],
                weight: 3.0,
            },
        ]
    );
    assert_eq!(split_zap_amounts(1000, &targets), vec![250, 750]);
}

#[test]
fn falls_back_to_event_or_profile_pubkey_without_zap_tags() {
    let event = event_with_tags(Vec::new());
    assert_eq!(
        zap_targets(&event, Some(&"b".repeat(64))),
        vec![ZapTarget {
            pubkey: "b".repeat(64),
            relays: Vec::new(),
            weight: 1.0,
        }]
    );
}

#[test]
fn parses_receipt_amounts_and_targets() {
    assert_eq!(
        zap_receipt_amount_msats(&zap_receipt(vec![tag(&["amount", "21000"])])),
        Some(21_000)
    );
    assert_eq!(
        zap_receipt_amount_msats(&zap_receipt(vec![tag(&[
            "description",
            r#"{"tags":[["amount","42000"]]}"#,
        ])])),
        Some(42_000)
    );
    assert_eq!(
        zap_target_event_id(&zap_receipt(vec![tag(&["e", &"e".repeat(64)])])),
        Some("e".repeat(64))
    );
}

#[test]
fn groups_zap_receipts_by_target_event() {
    let target = "e".repeat(64);
    let grouped = group_zap_receipts(&[
        zap_receipt(vec![tag(&["e", &target]), tag(&["amount", "1000"])]),
        zap_receipt(vec![tag(&["e", &target]), tag(&["amount", "2000"])]),
    ]);
    assert_eq!(
        grouped.get(&target),
        Some(&ZapReceiptGroup {
            target_event_id: target,
            amount_msats: 3_000,
            actors: vec!["f".repeat(64)],
        })
    );
}

fn zap_receipt(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        kind: KIND_ZAP_RECEIPT,
        tags,
        ..event_with_tags(Vec::new())
    }
}

fn event_with_tags(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "0".repeat(64),
        pubkey: "f".repeat(64),
        created_at: 1,
        kind: 1,
        tags,
        content: String::new(),
        sig: "a".repeat(128),
    }
}

fn tag(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

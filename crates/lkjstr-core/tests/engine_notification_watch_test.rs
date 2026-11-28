#![allow(clippy::expect_used)]
mod engine_read_union_support;
use engine_read_union_support::{NOW, R, event, frames};
use lkjstr_core::engine::{Engine, protocol::Input, wire};
use serde_json::{Value, json};

fn owner() -> String {
    event(1, 1, 1, vec![]).pubkey
}
fn setup() -> Engine {
    let mut e = Engine::new();
    e.network.configure(vec![R.into()], NOW);
    e.discover_account(Some(owner()), vec![], NOW);
    e.network.connected(R, NOW + 1);
    e
}
fn notification(frame: &Value) -> bool {
    frame[0] == "REQ"
        && frame.as_array().expect("frame")[2..].iter().any(|filter| {
            filter["#p"] == json!([owner()])
                && filter["kinds"]
                    .as_array()
                    .is_some_and(|ks| ks.contains(&json!(7)))
        })
}
fn hint(e: &mut Engine, hidden: bool, now: u64) {
    e.input(
        Input::Hint {
            visible_subs: vec![],
            focused_sub: None,
            page_hidden: hidden,
            idle: false,
            save_data: false,
        },
        now,
    );
}
fn head(e: &mut Engine) -> Value {
    frames(&mut e.network)
        .into_iter()
        .find(notification)
        .expect("saved account notification subscription")
}

#[test]
fn notification_watch_fetches_unread_without_a_notification_view_or_eose() {
    let mut e = setup();
    let mut first = None;
    for elapsed in (1..=4001).step_by(100) {
        for frame in frames(&mut e.network) {
            if notification(&frame) {
                first.get_or_insert((elapsed, frame));
            } else if frame[0] == "REQ" {
                e.network
                    .message(R, &json!(["EOSE", frame[1]]).to_string(), NOW + elapsed);
            }
        }
        if first.is_some() {
            break;
        }
        e.network.tick(NOW + elapsed + 100);
    }
    eprintln!(
        "no-view notification first #p REQ: {:?} ms",
        first.as_ref().map(|(at, _)| at)
    );
    let (elapsed, request) = first.expect("account notifications must not depend on an open view");
    assert_eq!(elapsed, 1);
    let reaction = event(2, NOW / 1000, 7, vec![vec!["p".into(), owner()]]);
    let accepted = e
        .network
        .message(
            R,
            &json!(["EVENT", request[1], reaction]).to_string(),
            NOW + 20,
        )
        .expect("notification ingress");
    e.enqueue(R.into(), accepted);
    e.tick(NOW + 25);
    assert_eq!(wire::unread_count(&e, &owner()), 1);
    assert_eq!(
        e.store.get(&reaction.id).expect("verified reaction").id,
        reaction.id
    );
}

#[test]
fn notification_watch_releases_on_hide_and_remove_and_restores_on_wake() {
    let mut e = setup();
    let request = head(&mut e);
    hint(&mut e, true, NOW + 101);
    assert!(
        frames(&mut e.network)
            .iter()
            .any(|f| *f == json!(["CLOSE", request[1]]))
    );
    let reaction = event(2, NOW / 1000, 7, vec![vec!["p".into(), owner()]]);
    assert!(
        e.network
            .message(
                R,
                &json!(["EVENT", request[1], reaction]).to_string(),
                NOW + 102
            )
            .is_none()
    );
    hint(&mut e, false, NOW + 201);
    e.network.connected(R, NOW + 201);
    let restored = head(&mut e);
    assert!(
        e.network
            .message(
                R,
                &json!(["EVENT", restored[1], reaction]).to_string(),
                NOW + 202
            )
            .is_some()
    );
    e.discover_account(None, vec![], NOW + 301);
    assert!(
        frames(&mut e.network)
            .iter()
            .any(|f| *f == json!(["CLOSE", restored[1]]))
    );
    assert!(
        e.network
            .message(
                R,
                &json!(["EVENT", restored[1], reaction]).to_string(),
                NOW + 302
            )
            .is_none()
    );
}

#[test]
fn notification_watch_admits_saved_account_inboxes_without_a_view() {
    let mut e = Engine::new();
    let list = event(
        1,
        1,
        10002,
        vec![
            vec!["r".into(), "wss://inbox.test/".into(), "read".into()],
            vec!["r".into(), "wss://outbox.test/".into(), "write".into()],
        ],
    );
    e.store.insert(list, None);
    e.network.configure(vec![R.into()], NOW);
    e.discover_account(Some(owner()), vec![], NOW);
    assert!(e.network.relays.contains_key("wss://inbox.test/"));
    assert!(!e.network.relays.contains_key("wss://outbox.test/"));
    e.network.connected("wss://inbox.test/", NOW + 1);
    head(&mut e);
    hint(&mut e, true, NOW + 101);
    assert!(!e.network.relays.contains_key("wss://inbox.test/"));
}

#[test]
fn notification_watch_distinguishes_inactive_inbox_hints_from_explicit_read_disables() {
    for disabled in [false, true] {
        let mut e = Engine::new();
        e.store.insert(
            event(
                1,
                1,
                10002,
                vec![vec!["r".into(), "wss://inbox.test/".into(), "read".into()]],
            ),
            None,
        );
        let mut entries = vec![wire::RelayConfig {
            url: R.into(),
            read: true,
            write: true,
            search: false,
        }];
        if disabled {
            entries.push(wire::RelayConfig {
                url: "wss://inbox.test/".into(),
                read: false,
                write: true,
                search: false,
            });
        }
        e.configure_relays(entries.clone(), NOW)
            .expect("active account routes");
        // Worker includes every saved account's advertised relays as discovery hints,
        // then applies the active account's independent read/write configuration.
        e.discover_account(Some(owner()), vec!["wss://inbox.test/".into()], NOW + 1);
        e.configure_relays(entries, NOW + 2)
            .expect("active account routes");
        assert!(
            !e.network.known["wss://inbox.test/"].read,
            "hint never enables general reads"
        );
        e.network.connected("wss://inbox.test/", NOW + 10);
        let requested = frames(&mut e.network).iter().any(notification);
        eprintln!("inactive inbox explicit_read_disable={disabled}: notification REQ={requested}");
        assert_eq!(requested, !disabled);
    }
}

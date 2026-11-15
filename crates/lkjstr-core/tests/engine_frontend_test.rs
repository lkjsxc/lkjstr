#![allow(clippy::expect_used, clippy::panic)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::json;

#[test]
fn thread_rows_keep_focus_for_ids_and_public_deep_links() {
    let note = event(1, 1, "focus", vec![]);
    for target in [
        json!({"id":note.id}),
        json!({"ref":lkjstr_protocol::encode_note(&note.id).expect("note")}),
    ] {
        let mut e = Engine::new();
        let mut s = Session::default();
        e.store.insert(note.clone(), None);
        let mut query = json!({"source":"thread"});
        query
            .as_object_mut()
            .expect("query")
            .extend(target.as_object().expect("target").clone());
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":"thread","query":query}),
            0,
        );
        let out = output(&mut s, &mut e);
        let rows = out.iter().find(|m| m["t"] == "rows").expect("rows");
        assert_eq!(rows["rows"][0]["thread"]["role"], "focus");
    }
}

#[test]
fn public_profile_reference_uses_decoded_owner_for_header() {
    let meta = event(1, 0, r#"{"name":"Profile owner"}"#, vec![]);
    let mut e = Engine::new();
    let mut s = Session::default();
    e.store.insert(meta.clone(), None);
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"profile","query":{"source":"profile","ref":lkjstr_protocol::encode_npub(&meta.pubkey).expect("npub")}}),
        0,
    );
    let out = output(&mut s, &mut e);
    let rows = out.iter().find(|m| m["t"] == "rows").expect("rows");
    assert_eq!(rows["rows"][0]["author"]["pubkey"], meta.pubkey);
    assert_eq!(rows["rows"][0]["author"]["name"], "Profile owner");
}

#[test]
fn owner_relay_list_is_bounded_and_keeps_read_write_modes() {
    let mut e = Engine::new();
    let list = event(
        1,
        10002,
        "",
        vec![
            vec!["r".into(), "wss://read.test".into(), "read".into()],
            vec!["r".into(), "https://bad.test".into()],
            vec!["r".into(), "wss://write.test".into(), "write".into()],
            vec!["r".into(), "wss://both.test".into()],
        ],
    );
    assert!(e.account_relays(&list.pubkey).is_none());
    e.store.insert(list.clone(), None);
    let (id, entries) = e.account_relays(&list.pubkey).expect("list");
    assert_eq!(id, list.id);
    assert_eq!(entries.len(), 3);
    assert!(entries[0].read && !entries[0].write);
    assert!(!entries[1].read && entries[1].write);
    assert!(entries[2].read && entries[2].write);
}

#[test]
fn search_only_relays_are_connected_and_receive_only_search_wants() {
    use lkjstr_core::engine::{
        protocol::{Query, Source},
        wire::RelayConfig,
    };
    let mut e = Engine::new();
    e.configure_relays(
        vec![RelayConfig {
            url: RELAY.into(),
            read: false,
            write: false,
            search: true,
        }],
        0,
    )
    .expect("configure");
    assert_eq!(e.network.relays.len(), 1);
    open(
        &mut e,
        Query {
            source: Source::Global,
            ..Default::default()
        },
    );
    e.network.connected(RELAY, 0);
    assert!(frames(&mut e).iter().all(|f| f[0] != "REQ"));
    e.input(
        lkjstr_core::engine::protocol::Input::Close { sub: "feed".into() },
        0,
    );
    open(
        &mut e,
        Query {
            source: Source::Search,
            filters: lkjstr_core::engine::protocol::Filters {
                text: Some("needle".into()),
                ..Default::default()
            },
            ..Default::default()
        },
    );
    e.network.connected(RELAY, 1);
    assert!(
        frames(&mut e)
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["search"] == "needle")
    );
}

#[test]
fn signed_out_account_views_finish_empty_without_relay_requests() {
    for source in ["home", "notifications", "bookmarks"] {
        let mut e = Engine::new();
        let mut s = Session::default();
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":"empty","query":{"source":source}}),
            0,
        );
        let out = output(&mut s, &mut e);
        let rows = out.iter().find(|m| m["t"] == "rows").expect("rows");
        assert_eq!(rows["rows"], json!([]));
        assert_eq!(rows["atBottom"], true);
        let state = out.iter().find(|m| m["t"] == "state").expect("state");
        assert_eq!(state["state"]["phase"], "done");
        assert_eq!(state["state"]["relaysAsked"], 0);
        assert!(frames(&mut e).is_empty());
    }
}

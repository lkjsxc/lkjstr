use std::collections::BTreeMap;

use lkjstr_domain::{
    NewTabIds, RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet, TabKind,
    WorkspaceIds, create_local_account_record, create_workspace, open_configured_tab,
};
use lkjstr_storage::{StorageOutcome, WorkspaceRecord};
use lkjstr_web::sqlite_store::{
    sqlite_event_relays, sqlite_events_by_author_kind, sqlite_local_account_put,
    sqlite_relay_set_put, sqlite_workspace_put,
};
use wasm_bindgen::prelude::JsValue;

use crate::accounts_selector_test_support::store_for;

mod nip07;
pub(crate) use nip07::{restore_nip07, seed_nip07_follow_publish};

const WRITE_RELAY: &str = "wss://follow-write.example/";

pub(crate) async fn seed_follow_publish(db_name: &str) -> Result<(String, String), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let (account, secret) = create_local_account_record(None, 7)
        .map_err(|_| js_error("local account create failed"))?;
    let target = pubkey("b");
    assert_ok(sqlite_local_account_put(&store, &account, &secret).await)?;
    assert_ok(sqlite_relay_set_put(&store, &write_relay_set()).await)?;
    assert_ok(sqlite_workspace_put(&store, &profile_workspace(&target)).await)?;
    assert_ok(client.close().await)?;
    Ok((account.pubkey, target))
}

pub(crate) async fn assert_published_follow(
    db_name: &str,
    account_pubkey: &str,
    target_pubkey: &str,
) -> Result<(), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let rows = assert_ok(
        sqlite_events_by_author_kind(
            &store,
            account_pubkey,
            lkjstr_protocol::KIND_FOLLOW_LIST,
            u64::MAX,
            1,
        )
        .await,
    )?;
    let event = rows
        .first()
        .ok_or_else(|| js_error("missing follow event"))?
        .event
        .clone();
    assert!(
        event
            .tags
            .iter()
            .any(|tag| tag == &vec!["p".to_owned(), target_pubkey.to_owned()])
    );
    assert_eq!(event.pubkey, account_pubkey);
    assert_eq!(event.kind, lkjstr_protocol::KIND_FOLLOW_LIST);
    assert_eq!(event.content, "");
    assert_eq!(event.sig.len(), 128);
    let relays = assert_ok(sqlite_event_relays(&store, &event.id).await)?;
    assert_eq!(
        relays.first().map(|row| row.relay_url.as_str()),
        Some(WRITE_RELAY)
    );
    assert_ok(client.close().await)
}

pub(crate) fn install_accepting_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            setTimeout(() => {
              if (this.onopen) this.onopen({ type: 'open' });
            }, 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'EVENT') return;
            const event = frame[1];
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage({
                  data: JSON.stringify(['OK', event.id, true, 'accepted']),
                });
              }
            }, 0);
          }
          close() {
            if (this.onclose) this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| ())
}

pub(crate) fn restore_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (window.__lkjstrOriginalWebSocket) {
          window.WebSocket = window.__lkjstrOriginalWebSocket;
          delete window.__lkjstrOriginalWebSocket;
        }
        "#,
    )
    .map(|_| ())
}

pub(crate) fn skip_unavailable_worker(error: JsValue) -> Result<(), JsValue> {
    if format!("{error:?}").contains("unavailable") {
        return Ok(());
    }
    Err(error)
}

fn profile_workspace(target_pubkey: &str) -> WorkspaceRecord {
    let mut config = BTreeMap::new();
    config.insert("pubkey".to_owned(), target_pubkey.to_owned());
    open_configured_tab(
        create_workspace(
            WorkspaceIds {
                workspace_id: "main".to_owned(),
                pane_id: "pane".to_owned(),
                group_id: "group".to_owned(),
                tab_id: "welcome".to_owned(),
            },
            1,
        ),
        Some("pane"),
        TabKind::Profile,
        NewTabIds {
            tab_id: "profile-tab".to_owned(),
        },
        config,
        2,
    )
}

fn write_relay_set() -> RelaySet {
    RelaySet {
        id: "profile-follow-write".to_owned(),
        name: "Profile Follow Write".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![RelayRecord {
            url: WRITE_RELAY.to_owned(),
            label: "Follow Write".to_owned(),
            enabled: true,
            read: false,
            write: true,
            state: RelayConnectionState::Idle,
            last_error: None,
            last_connected_at: None,
            updated_at: 9,
            health: RelayHealth::default(),
        }],
        updated_at: 9,
    }
}

fn assert_ok<T>(outcome: StorageOutcome<T>) -> Result<T, JsValue> {
    match outcome {
        StorageOutcome::Ok(value) => Ok(value),
        other => {
            let reason = other
                .problem()
                .map(|problem| problem.reason)
                .unwrap_or("unknown");
            Err(js_error(&format!("storage outcome failed: {reason}")))
        }
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}

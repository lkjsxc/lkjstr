#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{clear_legacy, reset_shells, wait_for_text};
use lkjstr_app::{StartupInput, default_recovery_ids};
use lkjstr_domain::{
    FeedTabSnapshot, NewTabIds, TabKind, TabSnapshotPayload, bootstrap_workspace, open_tab,
};
use lkjstr_storage::{TabStateRecord, tab_state_id};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_custom_request_tab_restores_input_and_run_state() -> Result<(), JsValue> {
    reset_shells()?;
    clear_legacy()?;
    lkjstr_ui::mount_app_with_startup(custom_request_startup(
        r#"{"filter":{"kinds":[1],"limit":7}}"#,
        true,
    ));

    wait_for_text("Run the restored request again.").await?;
    assert_eq!(
        custom_request_input()?.value(),
        r#"{"filter":{"kinds":[1],"limit":7}}"#
    );
    Ok(())
}

fn custom_request_startup(input: &str, ran: bool) -> StartupInput {
    let tab_id = "custom-request-restore-tab";
    StartupInput {
        stored_workspace: Some(open_tab(
            bootstrap_workspace(),
            Some("bootstrap-welcome-pane"),
            TabKind::CustomRequest,
            NewTabIds {
                tab_id: tab_id.to_owned(),
            },
            11,
        )),
        storage_available: true,
        tab_snapshots: vec![TabStateRecord {
            id: tab_state_id("main", tab_id),
            workspace_id: "main".to_owned(),
            tab_id: tab_id.to_owned(),
            last_pane_id: Some("bootstrap-welcome-pane".to_owned()),
            state: TabSnapshotPayload::Feed(FeedTabSnapshot {
                filter_state: BTreeMap::from([
                    ("customRequestInput".to_owned(), input.to_owned()),
                    ("customRequestRan".to_owned(), ran.to_string()),
                ]),
                ..FeedTabSnapshot::default()
            }),
            updated_at: 12,
        }],
        recovery_ids: default_recovery_ids("main"),
        now: 13,
    }
}

fn custom_request_input() -> Result<web_sys::HtmlTextAreaElement, JsValue> {
    Ok(document()?
        .query_selector("textarea[aria-label='Custom request JSON']")?
        .ok_or_else(|| js_error("missing custom request input"))?
        .dyn_into::<web_sys::HtmlTextAreaElement>()?)
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}

use lkjstr_domain::{SignerType, create_account, create_local_account_record, sign_local_event};
use lkjstr_protocol::UnsignedNostrEvent;
use lkjstr_web::sqlite_store::{sqlite_account_put, sqlite_relay_set_put, sqlite_workspace_put};
use wasm_bindgen::{closure::Closure, prelude::JsValue};

use crate::accounts_selector_test_support::store_for;

use super::{assert_ok, js_error, profile_workspace, write_relay_set};

pub(crate) async fn seed_nip07_follow_publish(db_name: &str) -> Result<(String, String), JsValue> {
    let (client, store) = store_for(db_name).await?;
    let (local, secret) = create_local_account_record(None, 7)
        .map_err(|_| js_error("local account create failed"))?;
    let account = create_account(&local.pubkey, SignerType::Nip07, 7)
        .ok_or_else(|| js_error("nip07 account create failed"))?;
    let target = pubkey("c");
    assert_ok(sqlite_account_put(&store, &account).await)?;
    assert_ok(sqlite_relay_set_put(&store, &write_relay_set()).await)?;
    assert_ok(sqlite_workspace_put(&store, &profile_workspace(&target)).await)?;
    assert_ok(client.close().await)?;
    install_nip07_signer(&account.pubkey, &secret.secret_key)?;
    Ok((account.pubkey, target))
}

pub(crate) fn restore_nip07() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (Object.prototype.hasOwnProperty.call(window, '__lkjstrOriginalNostr')) {
          const original = window.__lkjstrOriginalNostr;
          delete window.__lkjstrOriginalNostr;
          if (original === undefined) {
            delete window.nostr;
          } else {
            window.nostr = original;
          }
        }
        "#,
    )
    .map(|_| ())
}

fn install_nip07_signer(pubkey: &str, secret_key: &str) -> Result<(), JsValue> {
    save_original_nostr()?;
    let nostr = js_sys::Object::new();
    let public_key = pubkey.to_owned();
    let get_public_key =
        Closure::wrap(Box::new(move || JsValue::from_str(&public_key)) as Box<dyn Fn() -> JsValue>);
    js_sys::Reflect::set(
        &nostr,
        &JsValue::from_str("getPublicKey"),
        get_public_key.as_ref(),
    )?;
    get_public_key.forget();

    let secret_key = secret_key.to_owned();
    let sign_event = Closure::wrap(Box::new(move |value: JsValue| -> JsValue {
        let unsigned = match serde_wasm_bindgen::from_value::<UnsignedNostrEvent>(value) {
            Ok(unsigned) => unsigned,
            Err(_) => return js_sys::Error::new("bad unsigned event").into(),
        };
        let event = match sign_local_event(&unsigned, &secret_key) {
            Ok(event) => event,
            Err(_) => return js_sys::Error::new("signing failed").into(),
        };
        serde_wasm_bindgen::to_value(&event)
            .unwrap_or_else(|_| js_sys::Error::new("event encode failed").into())
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    js_sys::Reflect::set(&nostr, &JsValue::from_str("signEvent"), sign_event.as_ref())?;
    sign_event.forget();
    js_sys::Reflect::set(
        &web_sys::window()
            .ok_or_else(|| js_error("missing window"))?
            .into(),
        &JsValue::from_str("nostr"),
        &nostr,
    )
    .map(|_| ())
}

fn save_original_nostr() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (!Object.prototype.hasOwnProperty.call(window, '__lkjstrOriginalNostr')) {
          window.__lkjstrOriginalNostr = window.nostr;
        }
        "#,
    )
    .map(|_| ())
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

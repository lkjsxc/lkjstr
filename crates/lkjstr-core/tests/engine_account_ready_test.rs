use lkjstr_core::engine::wire::{PROTOCOL_VERSION, Session};
use serde_json::json;

#[test]
fn ordinary_ready_does_not_claim_account_loading_or_add_an_error() -> serde_json::Result<()> {
    for shared in [false, true] {
        let engine = if shared {
            "rust-wasm-shared"
        } else {
            "rust-wasm-worker"
        };
        let value = serde_json::to_value(Session::ready(shared))?;
        assert_eq!(
            value,
            json!({"t":"ready", "version":PROTOCOL_VERSION, "engine":engine})
        );
    }
    Ok(())
}

#[test]
fn failed_account_ready_is_fixed_code_only_for_each_transport() -> serde_json::Result<()> {
    for shared in [false, true] {
        let engine = if shared {
            "rust-wasm-shared"
        } else {
            "rust-wasm-worker"
        };
        let value = serde_json::to_value(Session::ready_account_unavailable(shared))?;
        assert_eq!(
            value,
            json!({
                "t":"ready", "version":PROTOCOL_VERSION, "engine":engine,
                "accountError":{"code":"internal"}
            })
        );
    }
    Ok(())
}

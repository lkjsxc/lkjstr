#![doc = "Follow graph WASM bridge."]

use serde::Serialize;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

use crate::response;

#[derive(Serialize)]
struct FollowGraphBridgeSummary {
    entries: Vec<lkjstr_protocol::FollowEntry>,
    following_count: usize,
}

#[wasm_bindgen]
pub fn follow_list_summary_json(event_json: &str) -> JsValue {
    match lkjstr_protocol::parse_nostr_event_json(event_json, None) {
        Ok(event) => {
            let summary = lkjstr_app::summarize_follow_list(&event);
            response::ok(FollowGraphBridgeSummary {
                entries: summary.entries,
                following_count: summary.following_count,
            })
        }
        Err(error) => response::error("invalid-event", error.message),
    }
}

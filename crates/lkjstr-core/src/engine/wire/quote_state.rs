//! Resolve embedded placeholders when finite reference requests have settled.
use super::*;
use crate::engine::Engine;
use serde_json::Value;
pub(super) fn settle(row: &mut Value, e: &Engine) {
    if let Some(quotes) = row.get_mut("quotes").and_then(Value::as_array_mut) {
        for quote in quotes {
            if quote["state"] == "loading"
                && quote["id"]
                    .as_str()
                    .is_some_and(|id| e.network.lookup_complete(id))
            {
                quote["state"] = Value::String("missing".into());
            }
        }
    }
    if let Some(note) = row.get_mut("note") {
        settle(note, e);
    }
}
impl Session {
    pub(super) fn settled_quote_patch(&mut self, sub: &str, e: &Engine) -> Vec<Value> {
        let Some(rows) = self.delivered.get_mut(sub) else {
            return vec![];
        };
        let mut ops = Vec::new();
        for row in rows {
            let before = row.clone();
            settle(row, e);
            if before != *row {
                ops.push(serde_json::json!({"op":"update","row":row}));
            }
        }
        ops
    }
}

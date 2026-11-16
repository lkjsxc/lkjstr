//! Frontend supplies only near, uncovered note ids, never addresses. Closing/hiding releases wants.
use super::*;
use crate::engine::{Engine, preview, protocol as p};
use serde_json::{Value, json};
impl Session {
    pub fn output(&mut self, out: p::Output, engine: &Engine) -> Vec<Output> {
        let sub = match &out {
            p::Output::Rows { sub, .. }
            | p::Output::Patch { sub, .. }
            | p::Output::Fresh { sub, .. }
            | p::Output::Status { sub, .. } => Some(sub.clone()),
            _ => None,
        };
        let mut output = self.output_inner(out, engine);
        self.notification_state(sub.as_deref(), &mut output, engine);
        for out in &mut output {
            self.preview_output(out, engine);
            self.private_output(out, engine);
        }
        output
    }

    pub fn preview_near(&mut self, sub: String, ids: Vec<String>) {
        if self.queries.contains_key(&sub)
            && (self.preview_near.contains_key(&sub) || self.preview_near.len() < 128)
        {
            self.preview_near.insert(
                sub,
                ids.into_iter()
                    .filter(|id| id.len() <= 256)
                    .take(32)
                    .collect(),
            );
        }
    }
    pub fn preview_want(&self, engine: &Engine) -> Option<String> {
        if self.config.link_previews == Some(false) || self.preview_save_data || self.preview_hidden
        {
            return None;
        }
        self.preview_near
            .iter()
            .filter(|(sub, _)| self.preview_visible.contains(sub))
            .find_map(|(sub, ids)| {
                self.delivered
                    .get(sub)?
                    .iter()
                    .map(|row| row.get("note").unwrap_or(row))
                    .filter(|r| ids.iter().any(|id| r["id"] == *id))
                    .flat_map(preview::links)
                    .find(|url| engine.previews.unasked(url))
            })
    }
    pub fn preview_refresh(&mut self, engine: &Engine) -> Vec<Output> {
        let enabled = self.config.link_previews != Some(false)
            && !self.preview_save_data
            && engine.previews.available;
        let mut out = Vec::new();
        for (sub, rows) in &mut self.delivered {
            let mut ops = Vec::new();
            for row in rows {
                let before = row.clone();
                decorate(row, engine, enabled);
                if before != *row {
                    ops.push(json!({"op":"update","row":row}));
                }
            }
            if !ops.is_empty() {
                out.push(Output::Patch {
                    sub: sub.clone(),
                    ops,
                });
            }
        }
        out
    }
    pub fn preview_output(&self, out: &mut Output, engine: &Engine) {
        let enabled = self.config.link_previews != Some(false)
            && !self.preview_save_data
            && engine.previews.available;
        match out {
            Output::Rows { rows, .. } => {
                for row in rows {
                    decorate(row, engine, enabled);
                }
            }
            Output::Patch { ops, .. } => {
                for op in ops {
                    if let Some(row) = op.get_mut("row") {
                        decorate(row, engine, enabled);
                    }
                    if let Some(rows) = op.get_mut("rows").and_then(Value::as_array_mut) {
                        for row in rows {
                            decorate(row, engine, enabled);
                        }
                    }
                }
            }
            _ => {}
        }
    }
}
fn decorate(row: &mut Value, engine: &Engine, enabled: bool) {
    if row["kind"] == "note" {
        if enabled {
            row["previews"] = json!(engine.previews.cards(row));
        } else if let Some(row) = row.as_object_mut() {
            row.remove("previews");
        }
    }
    if let Some(note) = row.get_mut("note") {
        decorate(note, engine, enabled);
    }
}

#[cfg(test)]
#[path = "previews_test.rs"]
mod tests;

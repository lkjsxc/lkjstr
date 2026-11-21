use super::{Output, Session, output_diff::diff};
use crate::engine::{Engine, protocol::Patch};
use serde_json::Value;
use std::collections::BTreeMap;

impl Session {
    pub(super) fn patch(
        &mut self,
        sub: String,
        changes: Vec<Patch>,
        order: Vec<String>,
        engine: &Engine,
    ) -> Vec<Output> {
        let previous = self.delivered.remove(&sub).unwrap_or_default();
        self.evidence_of_pruning(&sub, &previous, engine);
        // These sources own a separate projection and order. Translate it once.
        let mut next = if self.projects_source(&sub) {
            self.source_rows(&sub, engine)
        } else {
            let retained: BTreeMap<_, _> = previous
                .iter()
                .filter_map(|row| Some((row["key"].as_str()?, row)))
                .collect();
            let mut updated = BTreeMap::new();
            for change in changes {
                if let Patch::Upsert { item, .. } = change {
                    let key = item.id.clone();
                    let projected = self.rows(&sub, &[*item], engine).into_iter().next();
                    updated.insert(key, projected);
                }
            }
            join_rows(order, &retained, &mut updated)
        };
        super::visibility_terminal::retain_terminal(
            &previous,
            &mut next,
            engine,
            None,
            true,
            !self.windows.contains_key(&sub),
        );
        if super::list_edges::finite(
            self.queries
                .get(&sub)
                .and_then(|q| q.convert())
                .map(|q| q.source),
        ) {
            let (at_top, at_bottom) = self.source_edges(&sub, engine);
            self.delivered.insert(sub.clone(), next.clone());
            return vec![Output::Rows {
                sub,
                rows: next,
                at_top,
                at_bottom,
            }];
        }
        let ops = diff(&previous, &next);
        self.delivered.insert(sub.clone(), next);
        if ops.is_empty() {
            vec![]
        } else {
            vec![Output::Patch { sub, ops }]
        }
    }
}

fn join_rows(
    order: Vec<String>,
    retained: &BTreeMap<&str, &Value>,
    updated: &mut BTreeMap<String, Option<Value>>,
) -> Vec<Value> {
    order
        .iter()
        .filter_map(|key| match updated.remove(key) {
            Some(projection) => projection,
            None => retained.get(key.as_str()).map(|row| (*row).clone()),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn patch_reuses_shifted_rows_and_keeps_changed_and_filtered_rows_in_order() {
        let a = json!({"key":"a","text":"unchanged"});
        let b = json!({"key":"b","text":"old"});
        let c = json!({"key":"c","text":"now hidden"});
        let d = json!({"key":"d","text":"outside the window"});
        let next_b = json!({"key":"b","text":"updated"});
        let inserted = json!({"key":"n","text":"new head"});
        let retained = BTreeMap::from([("a", &a), ("b", &b), ("c", &c), ("d", &d)]);
        let mut updated = BTreeMap::from([
            ("n".into(), Some(inserted.clone())),
            ("b".into(), Some(next_b.clone())),
            ("c".into(), None),
        ]);
        let next = join_rows(
            ["n", "a", "c", "b"].map(str::to_owned).to_vec(),
            &retained,
            &mut updated,
        );
        assert_eq!(next, vec![inserted, a, next_b]);
    }

    #[test]
    fn head_insert_and_count_update_match_full_projection_with_a_held_anchor()
    -> Result<(), Box<dyn std::error::Error>> {
        use crate::engine::wire::Input;
        use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

        let key = generate_secret_key();
        let sign = |at, kind, tags| {
            finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: at,
                    kind,
                    tags,
                    content: if kind == 7 {
                        "+".into()
                    } else {
                        format!("fixture {at}")
                    },
                },
                &key,
            )
            .map_err(|_| "fixture signing failed")
        };
        let first = sign(1, 1, vec![])?;
        let anchor = sign(2, 1, vec![])?;
        let newest = sign(3, 1, vec![])?;
        let next = sign(4, 1, vec![])?;
        let reaction = sign(5, 7, vec![vec!["e".into(), anchor.id.clone()]])?;
        let mut engine = Engine::new();
        for note in [first, anchor.clone(), newest.clone()] {
            engine.store.insert(note, None);
        }
        let mut session = Session::default();
        for (sub, source) in [
            ("top", "global"),
            ("held", "global"),
            ("projected", "profile"),
        ] {
            let open = serde_json::from_value::<Input>(json!({
                "t":"open","sub":sub,
                "query":{"source":source,"account":anchor.pubkey,"pubkey":anchor.pubkey}
            }))?;
            for input in session.input(open, &engine).map_err(|(_, code)| code)? {
                engine.input(input, 0);
            }
        }
        let window = serde_json::from_value::<Input>(json!({
            "t":"window","sub":"held","anchor":{"key":anchor.id},"before":1,"after":2
        }))?;
        for input in session.input(window, &engine).map_err(|(_, code)| code)? {
            engine.input(input, 0);
        }
        for output in engine.drain() {
            session.output(output, &engine);
        }
        engine.store.insert(next.clone(), None);
        engine.store.insert(reaction, None);
        engine.invalidate();
        engine.tick(100);
        let patches: Vec<_> = engine
            .drain()
            .into_iter()
            .flat_map(|output| session.output(output, &engine))
            .collect();
        assert!(
            patches
                .iter()
                .any(|output| matches!(output, Output::Patch { sub, ops }
            if sub == "top" && ops.iter().any(|op| op["op"] == "insert")
                && ops.iter().any(|op| op["op"] == "update"
                    && op["row"]["key"] == anchor.id && op["row"]["counts"]["reactions"] == 1)))
        );
        let incremental = session.delivered.clone();
        assert_eq!(incremental["top"][0]["key"], next.id);
        assert_eq!(incremental["held"][0]["key"], newest.id);
        assert_eq!(incremental["held"][1]["key"], anchor.id);
        for sub in ["top", "held", "projected"] {
            engine.render(sub, true);
            for output in engine.drain() {
                session.output(output, &engine);
            }
            assert_eq!(incremental[sub], session.delivered[sub]);
        }
        Ok(())
    }
}

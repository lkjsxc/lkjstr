use super::*;
use crate::engine::Engine;
use serde_json::json;
#[test]
fn preview_wants_need_delivered_near_visible_rows_and_permission() {
    let mut e = Engine::new();
    e.previews.available = true;
    let mut s = Session::default();
    s.queries.insert(
        "view".into(),
        serde_json::from_value(json!({"source":"global"})).unwrap_or_else(|_| unreachable!()),
    );
    s.delivered.insert("view".into(), vec![json!({"kind":"note","id":"note","segments":[{"k":"link","url":"https://example.com/first"},{"k":"link","url":"https://example.com/second"}]})]);
    s.preview_near("view".into(), vec!["note".into()]);
    assert!(s.preview_want(&e).is_none());
    s.preview_visible = vec!["view".into()];
    assert_eq!(
        s.preview_want(&e).as_deref(),
        Some("https://example.com/first")
    );
    s.preview_save_data = true;
    assert!(s.preview_want(&e).is_none());
    s.preview_save_data = false;
    s.preview_hidden = true;
    assert!(s.preview_want(&e).is_none());
    s.preview_hidden = false;
    s.config.link_previews = Some(false);
    assert!(s.preview_want(&e).is_none());
    s.config.link_previews = Some(true);
    s.preview_near("view".into(), vec!["unknown".into()]);
    assert!(s.preview_want(&e).is_none());
    s.preview_near("view".into(), vec!["note".into()]);
    assert!(e.previews.begin("https://example.com/first"));
    assert_eq!(
        s.preview_want(&e).as_deref(),
        Some("https://example.com/second")
    );
    assert!(e.previews.begin("https://example.com/second"));
    assert!(s.preview_want(&e).is_none());
    s.preview_near("view".into(), vec![]);
    assert!(s.preview_want(&e).is_none());
}

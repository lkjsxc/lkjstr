use super::*;
use crate::engine::Engine;
use serde_json::json;

#[test]
fn quote_preview_wants_require_the_quote_id_and_settle_on_the_parent() {
    let mut e = Engine::new();
    e.previews.available = true;
    let mut s = Session::default();
    s.queries.insert(
        "view".into(),
        serde_json::from_value(json!({"source":"global"})).unwrap_or_else(|_| unreachable!()),
    );
    let url = "https://example.com/quoted";
    s.delivered.insert(
        "view".into(),
        vec![json!({"kind":"note","id":"outer","quotes":[{
            "state":"ok","id":"quoted","segments":[{"k":"link","url":url}]
        }]})],
    );
    s.preview_visible = vec!["view".into()];
    s.preview_near("view".into(), vec!["outer".into()]);
    assert!(s.preview_want(&e).is_none());
    s.preview_near("view".into(), vec!["quoted".into()]);
    assert_eq!(s.preview_want(&e).as_deref(), Some(url));
    assert!(e.previews.begin(url));
    e.previews
        .finish(url, Some(json!({"kind":"page","url":url,"title":"Story"})));
    assert_eq!(s.preview_refresh(&e).len(), 1);
    assert_eq!(
        s.delivered["view"][0]["quotes"][0]["previews"][0]["title"],
        "Story"
    );
}

#[test]
fn nested_notification_previews_settle_in_notifications_and_mixed_feeds() {
    for source in ["notifications", "home", "global"] {
        for kind in ["reply", "mention"] {
            let mut e = Engine::new();
            e.previews.available = true;
            let mut s = Session::default();
            s.queries.insert(
                "view".into(),
                serde_json::from_value(json!({"source":source,"account":"reader"}))
                    .unwrap_or_else(|_| unreachable!()),
            );
            s.delivered.insert(
                "view".into(),
                vec![json!({
                    "kind":"notification", "key":"wrapper", "type":kind,
                    "note":{"kind":"note", "id":"note", "segments":[
                        {"k":"link", "url":"https://example.com/nested"}
                    ]}
                })],
            );
            s.preview_visible = vec!["view".into()];
            let loading = s.preview_refresh(&e);
            assert_eq!(loading.len(), 1);
            assert_eq!(
                s.delivered["view"][0]["note"]["previews"][0]["kind"],
                "loading"
            );
            s.preview_near("view".into(), vec!["wrapper".into()]);
            assert!(s.preview_want(&e).is_none());
            s.preview_near("view".into(), vec!["note".into()]);
            assert_eq!(
                s.preview_want(&e).as_deref(),
                Some("https://example.com/nested")
            );
            assert!(e.previews.begin("https://example.com/nested"));
            assert!(s.preview_want(&e).is_none());
            e.previews.finish(
                "https://example.com/nested",
                Some(json!({
                    "url":"https://example.com/nested", "kind":"page", "title":"Nested page"
                })),
            );
            let settled = s.preview_refresh(&e);
            assert_eq!(settled.len(), 1);
            assert_eq!(
                s.delivered["view"][0]["note"]["previews"][0]["title"],
                "Nested page"
            );
            assert!(s.preview_refresh(&e).is_empty());
        }
    }
}

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

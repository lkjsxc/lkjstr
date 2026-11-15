use lkjstr_core::engine::{
    Engine,
    preview::{Previews, links},
    wire::Session,
};
use serde_json::json;
#[test]
fn preview_links_are_unique_bounded_and_not_media_or_nostr() {
    let row = json!({"segments":[{"k":"link","url":"https://example.com/1"},{"k":"link","url":"https://example.com/1"},{"k":"ref","bech32":"nostr:note1"},{"k":"link","url":"https://example.com/2"},{"k":"link","url":"https://example.com/3"}],"media":[{"url":"https://example.com/p.jpg"}]});
    assert_eq!(
        links(&row),
        vec!["https://example.com/1", "https://example.com/2"]
    );
}
#[test]
fn service_absence_no_attempts_and_each_link_once_with_bounded_eviction() {
    let mut previews = Previews::default();
    assert!(!previews.begin("https://example.com/1"));
    previews.available = true;
    assert!(previews.begin("https://example.com/1"));
    assert!(!previews.begin("https://example.com/1"));
    previews.finish("https://example.com/1", None);
    assert!(!previews.begin("https://example.com/1"));
    for n in 2..=2049 {
        assert!(previews.begin(&format!("https://example.com/{n}")));
    }
    assert!(previews.unasked("https://example.com/1"));
}
#[test]
fn near_wants_are_released_when_hidden_or_closed() {
    let mut engine = Engine::new();
    engine.previews.available = true;
    let mut session = Session::default();
    session.queries.insert(
        "s".into(),
        serde_json::from_value(json!({"source":"global"})).unwrap_or_else(|_| unreachable!()),
    );
    session.preview_visible = vec!["s".into()];
    session.preview_near("s".into(), vec!["note".into()]);
    // No delivered row is no permission to fetch arbitrary addresses.
    assert!(session.preview_want(&engine).is_none());
    session.preview_hidden = true;
    assert!(session.preview_want(&engine).is_none());
    session
        .input(
            lkjstr_core::engine::wire::Input::Close { sub: "s".into() },
            &engine,
        )
        .unwrap_or_else(|_| unreachable!());
    assert!(session.preview_near.is_empty());
}
#[test]
fn failed_and_untitled_previews_close_the_slot_until_the_failure_cache_expires() {
    let mut previews = Previews::default();
    previews.available = true;
    let url = "https://example.com/story";
    let row = json!({"segments":[{"k":"link","url":url},{"k":"link","url":url}]});
    for answer in [
        None,
        Some(json!({"url":url,"kind":"page","title":"  "})),
        Some(json!({"url":url,"kind":"link","title":"/story"})),
    ] {
        previews.tick(0);
        assert!(previews.begin(url));
        assert_eq!(previews.cards(&row).len(), 1);
        previews.finish(url, answer);
        assert!(previews.cards(&row).is_empty());
        previews.tick(3_599_999);
        assert!(!previews.unasked(url));
        assert!(previews.cards(&row).is_empty());
        previews.tick(3_600_000);
        assert!(previews.unasked(url));
    }
    assert!(previews.begin(url));
    previews.finish(
        url,
        Some(json!({"url":url,"kind":"page","title":"A title"})),
    );
    assert_eq!(previews.cards(&row).len(), 1);
}

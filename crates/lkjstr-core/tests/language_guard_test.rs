//! String formatting policy remains independent of interface rendering.
use lkjstr_core::{appearance::Language, words};

#[test]
fn formatting_does_not_interpret_user_text_as_another_slot() {
    assert_eq!(
        words::format(Language::Japanese, "Replying to {0}", &["{1}さん"]),
        "{1}さんさんへの返信"
    );
    assert_eq!(
        words::format(Language::English, "{0} new · show", &["12"]),
        "12 new · show"
    );
}

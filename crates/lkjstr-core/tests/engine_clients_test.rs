#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{
    clients::Clients,
    protocol::{Input, Output, Query},
};
#[test]
fn clients_have_isolated_ids_visibility_and_signing_responses() {
    let mut c = Clients::default();
    let a = c.connect(0).expect("a");
    let b = c.connect(0).expect("b");
    for id in [a, b] {
        let inputs = c.input(
            id,
            Input::Open {
                sub: "same".into(),
                query: Query::default(),
            },
            1,
        );
        assert!(matches!(&inputs[0],Input::Open{sub,..} if sub==&format!("{id}:same")));
    }
    let inputs = c.input(
        a,
        Input::Hint {
            visible_subs: vec![],
            page_hidden: true,
            idle: false,
            save_data: false,
        },
        2,
    );
    assert!(
        matches!(&inputs[0],Input::Hint{visible_subs,..} if visible_subs==&vec![format!("{b}:same")])
    );
    let out = c.output(Output::Error {
        req: Some(format!("{a}:sign")),
        code: "signer-rejected".into(),
    });
    assert_eq!(out.len(), 1);
    assert_eq!(out[0].0, a);
    assert!(matches!(&out[0].1,Output::Error{req:Some(req),..} if req=="sign"));
    let close = c.disconnect(a);
    assert!(matches!(&close[0],Input::Close{sub} if sub==&format!("{a}:same")));
    assert!(
        c.output(Output::Error {
            req: Some(format!("{a}:sign")),
            code: "late".into()
        })
        .is_empty()
    );
    assert_eq!(c.expire(200000), vec![b]);
}

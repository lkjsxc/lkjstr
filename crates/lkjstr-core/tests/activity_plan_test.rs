use lkjstr_core::{
    plan::{Directory, PlanContext, RelayDefaults, Want, plan},
    relays::Scores,
};
struct Book;
impl Directory for Book {
    fn write_relays(&self, _: &str) -> Option<Vec<String>> {
        None
    }
    fn read_relays(&self, _: &str) -> Option<Vec<String>> {
        None
    }
}
#[test]
fn activity_batches_visible_notes_and_includes_receipts_with_a_bound() {
    let defaults = RelayDefaults {
        read: vec!["wss://local.invalid/".into()],
        ..Default::default()
    };
    let scores = Scores::default();
    let requests = plan(
        &[
            (
                1,
                Want::Activity {
                    ids: vec!["a".into()],
                },
            ),
            (
                2,
                Want::Activity {
                    ids: vec!["b".into()],
                },
            ),
        ],
        &PlanContext {
            defaults: &defaults,
            directory: &Book,
            scores: &scores,
            now_ms: 0,
        },
    );
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].filters[0].kinds, Some(vec![1, 6, 7, 9735]));
    assert_eq!(requests[0].filters[0].tags["e"], vec!["a", "b"]);
    assert_eq!(requests[0].filters[0].limit, Some(3000));
    assert_eq!(requests[0].wants.len(), 2);
    assert!(!requests[0].live);
}

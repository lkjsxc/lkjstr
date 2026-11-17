use super::{check, check_file};
use std::path::Path;

const ASSERTION_HELPERS: &str =
    "value.unwrap();\nvalue.expect(\"fixture\");\npanic!(\"failed assertion\");";

#[test]
fn assertion_helpers_are_allowed_in_test_files_and_shared_fixtures() {
    for path in [
        "crates/example/tests/actions.rs",
        "crates/example/tests/common/mod.rs",
        "crates/example/src/actions_test.rs",
        "crates/lkjstr-core/examples/read-score/driver.rs",
        "crates/lkjstr-core/examples/read-score/fixture.rs",
    ] {
        let mut problems = Vec::new();
        check_file(&mut problems, path, ASSERTION_HELPERS);
        assert!(problems.is_empty(), "{path}: {problems:?}");
    }
}

#[test]
fn production_assertion_helpers_are_rejected_even_with_clippy_allowances() {
    for path in [
        "crates/example/src/actions.rs",
        "crates/example/src/tests_helpers.rs",
        "crates/example/src/actions_test.rs.backup.rs",
        "crates/lkjstr-core/examples/read_score/fixture.rs",
    ] {
        let mut problems = Vec::new();
        let text = format!("#![allow(clippy::unwrap_used)]\n{ASSERTION_HELPERS}");
        check_file(&mut problems, path, &text);
        assert_eq!(
            problems,
            [
                format!("{path}: line 2 forbids unwrap call"),
                format!("{path}: line 3 forbids expect call"),
                format!("{path}: line 4 forbids panic macro"),
            ]
        );
    }
}

#[test]
fn unfinished_code_and_debug_macros_remain_rejected_everywhere() {
    for path in [
        "crates/example/src/lib.rs",
        "crates/example/tests/actions.rs",
    ] {
        let mut problems = Vec::new();
        check_file(
            &mut problems,
            path,
            "dbg!(value);\ntodo!();\nunimplemented!();",
        );
        assert_eq!(problems.len(), 3, "{path}: {problems:?}");
    }
}

#[test]
fn production_checks_ignore_comments_and_strings() {
    let mut problems = Vec::new();
    check_file(
        &mut problems,
        "crates/example/src/lib.rs",
        "// value.unwrap();\nlet example = \"value.expect(); panic!();\";",
    );
    assert!(problems.is_empty(), "{problems:?}");
}

#[test]
fn repository_passes_the_style_precheck_used_by_docker_verify() -> Result<(), String> {
    check(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .as_path(),
    )
}

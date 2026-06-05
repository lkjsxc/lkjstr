use lkjstr_app::{ProfileScanDecision, ProfileScanInput, plan_profile_sparse_scan};

#[test]
fn complete_empty_windows_continue_older_until_floor() {
    let decision = plan_profile_sparse_scan(ProfileScanInput {
        until: 10_000,
        span_seconds: 1_000,
        floor: 0,
        complete_empty: true,
        dense: false,
        incomplete: false,
    });

    assert_eq!(
        decision,
        ProfileScanDecision::ContinueOlder {
            since: 7_000,
            until: 9_000,
            span_seconds: 2_000,
        }
    );
}

#[test]
fn dense_or_incomplete_windows_do_not_prove_empty() {
    assert!(matches!(
        plan_profile_sparse_scan(ProfileScanInput {
            until: 10_000,
            span_seconds: 1_000,
            floor: 0,
            complete_empty: false,
            dense: true,
            incomplete: false,
        }),
        ProfileScanDecision::RetryDense { .. }
    ));
    assert_eq!(
        plan_profile_sparse_scan(ProfileScanInput {
            until: 10_000,
            span_seconds: 1_000,
            floor: 0,
            complete_empty: true,
            dense: false,
            incomplete: true,
        }),
        ProfileScanDecision::WaitForProof
    );
}

#[test]
fn floor_complete_empty_proves_absence() {
    assert_eq!(
        plan_profile_sparse_scan(ProfileScanInput {
            until: 500,
            span_seconds: 1_000,
            floor: 0,
            complete_empty: true,
            dense: false,
            incomplete: false,
        }),
        ProfileScanDecision::EmptyProven
    );
}

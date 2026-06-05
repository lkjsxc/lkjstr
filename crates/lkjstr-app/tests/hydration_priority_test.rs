use lkjstr_app::{HydrationJob, HydrationPriority, plan_hydration_jobs};

#[test]
fn visible_jobs_run_before_near_and_background() {
    let (jobs, cancelled) = plan_hydration_jobs(
        &[
            job("background", HydrationPriority::Background, 7),
            job("near", HydrationPriority::NearVisible, 7),
            job("visible", HydrationPriority::Visible, 7),
        ],
        7,
    );

    assert_eq!(keys(&jobs), vec!["visible", "near", "background"]);
    assert!(cancelled.is_empty());
}

#[test]
fn hidden_stale_and_duplicate_jobs_do_not_run() {
    let (jobs, cancelled) = plan_hydration_jobs(
        &[
            job("same", HydrationPriority::NearVisible, 3),
            job("same", HydrationPriority::Visible, 3),
            job("hidden", HydrationPriority::HiddenPaused, 3),
            job("stale", HydrationPriority::Visible, 2),
        ],
        3,
    );

    assert_eq!(keys(&jobs), vec!["same"]);
    assert_eq!(cancelled, vec!["stale"]);
}

fn job(key: &str, priority: HydrationPriority, generation: u64) -> HydrationJob {
    HydrationJob {
        key: key.to_owned(),
        priority,
        generation,
    }
}

fn keys(jobs: &[HydrationJob]) -> Vec<&str> {
    jobs.iter().map(|job| job.key.as_str()).collect()
}

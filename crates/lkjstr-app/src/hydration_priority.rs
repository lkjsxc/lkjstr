#![doc = "Visibility-prioritized hydration scheduler reducer."]

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum HydrationPriority {
    Visible,
    NearVisible,
    ActiveOffscreen,
    HiddenPaused,
    Background,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HydrationJob {
    pub key: String,
    pub priority: HydrationPriority,
    pub generation: u64,
}

#[must_use]
pub fn plan_hydration_jobs(
    jobs: &[HydrationJob],
    active_generation: u64,
) -> (Vec<HydrationJob>, Vec<String>) {
    let mut cancelled = Vec::new();
    let mut by_key = std::collections::BTreeMap::<String, HydrationJob>::new();
    for job in jobs {
        if job.generation != active_generation || job.priority == HydrationPriority::Cancelled {
            cancelled.push(job.key.clone());
            continue;
        }
        if job.priority == HydrationPriority::HiddenPaused {
            continue;
        }
        by_key
            .entry(job.key.clone())
            .and_modify(|current| {
                if job.priority < current.priority {
                    *current = job.clone();
                }
            })
            .or_insert_with(|| job.clone());
    }
    let mut runnable = by_key.into_values().collect::<Vec<_>>();
    runnable.sort_by(|a, b| a.priority.cmp(&b.priority).then_with(|| a.key.cmp(&b.key)));
    (runnable, cancelled)
}

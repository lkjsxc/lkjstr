use leptos::prelude::*;
use lkjstr_storage::{StorageFeedGeometryStats, StorageStatsSnapshot};

pub(crate) fn feed_geometry_rows(snapshot: Option<StorageStatsSnapshot>) -> impl IntoView {
    match snapshot {
        Some(snapshot) => rows_for_stats(snapshot.feed_geometry).into_any(),
        None => view! {
            <tr><th>"Status"</th><td>"loading"</td></tr>
        }
        .into_any(),
    }
}

fn rows_for_stats(stats: StorageFeedGeometryStats) -> impl IntoView {
    let observations = feed_geometry_value(&stats, |item| item.observation_rows);
    let models = feed_geometry_value(&stats, |item| item.model_rows);
    view! {
        <tr><th>"Status"</th><td>{stats.status}</td></tr>
        <tr><th>"Observed row heights"</th><td>{observations}</td></tr>
        <tr><th>"Geometry models"</th><td>{models}</td></tr>
    }
}

fn feed_geometry_value(
    stats: &StorageFeedGeometryStats,
    value: fn(&StorageFeedGeometryStats) -> Option<u64>,
) -> String {
    value(stats).map_or_else(
        || {
            stats
                .problem_reason
                .clone()
                .unwrap_or_else(|| stats.status.clone())
        },
        |count| count.to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feed_geometry_value_keeps_exact_problem() {
        let stats = StorageFeedGeometryStats {
            status: "partial".to_string(),
            observation_rows: Some(12),
            model_rows: None,
            problem_reason: Some("blocked".to_string()),
        };

        assert_eq!(
            feed_geometry_value(&stats, |item| item.observation_rows),
            "12"
        );
        assert_eq!(
            feed_geometry_value(&stats, |item| item.model_rows),
            "blocked"
        );
    }
}

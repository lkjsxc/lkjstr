#[derive(Clone, Debug, PartialEq)]
pub struct OrchestrationPolicy {
    pub viewport_prefetch_rows: usize,
    pub hydration_near_rows: usize,
    pub high_storage_pressure: f64,
}

impl Default for OrchestrationPolicy {
    fn default() -> Self {
        Self {
            viewport_prefetch_rows: 8,
            hydration_near_rows: 12,
            high_storage_pressure: 0.85,
        }
    }
}

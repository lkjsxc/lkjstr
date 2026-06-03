#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OrchestrationDecisionTrace {
    pub semantic_feed_key: String,
    pub decision: String,
    pub evidence: Vec<String>,
    pub diagnostics: Vec<String>,
    pub created_at_ms: u64,
}

impl OrchestrationDecisionTrace {
    #[must_use]
    pub fn new(
        semantic_feed_key: impl Into<String>,
        decision: impl Into<String>,
        created_at_ms: u64,
    ) -> Self {
        Self {
            semantic_feed_key: semantic_feed_key.into(),
            decision: decision.into(),
            evidence: Vec::new(),
            diagnostics: Vec::new(),
            created_at_ms,
        }
    }
}

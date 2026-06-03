#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanPlanDiagnostic {
    pub message: String,
}

impl ScanPlanDiagnostic {
    #[must_use]
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

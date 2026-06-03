#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CoverageEvidenceState {
    Complete,
    Partial,
    Missing,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptimizerEvidenceState {
    pub relay_scores: bool,
    pub route_evidence: bool,
    pub scan_density: bool,
    pub row_geometry: bool,
}

impl OptimizerEvidenceState {
    #[must_use]
    pub const fn none() -> Self {
        Self {
            relay_scores: false,
            route_evidence: false,
            scan_density: false,
            row_geometry: false,
        }
    }
}

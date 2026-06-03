#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmptyProofInput {
    pub complete_coverage_proves_absence: bool,
    pub required_relays_terminal: bool,
    pub pending_required_relays: bool,
    pub renderable_rows: usize,
}

#[must_use]
pub fn feed_empty_is_terminal(input: &EmptyProofInput) -> bool {
    input.renderable_rows == 0
        && (input.complete_coverage_proves_absence
            || (input.required_relays_terminal && !input.pending_required_relays))
}

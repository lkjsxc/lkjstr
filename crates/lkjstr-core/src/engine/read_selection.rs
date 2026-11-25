use std::collections::{BTreeMap, BTreeSet};
#[derive(Clone, Debug)]
pub struct Candidate {
    pub url: String,
    /// Quantized 0..1000 transport quality; zero is cooling down.
    pub weight: u64,
    /// Requested authors whose verified list advertises this relay for writing.
    pub authors: BTreeSet<String>,
}

/// Greedy coverage with a quality prior. Two copies are useful; first coverage
/// counts twice. Unknown authors stay on ordinary reader-selected routes.
/// This bounded selector does not claim global two-cover or discover transports.
pub fn select(candidates: &[Candidate], limit: usize) -> Vec<String> {
    select_weighted(candidates, limit, |_| 1)
}
pub fn select_weighted(
    candidates: &[Candidate],
    limit: usize,
    person: impl Fn(&str) -> u64,
) -> Vec<String> {
    let mut selected = Vec::new();
    let mut covered = BTreeMap::<&str, usize>::new();
    while selected.len() < limit.min(candidates.len()) {
        let best = candidates
            .iter()
            .filter(|r| !selected.contains(&r.url))
            .max_by(|a, b| {
                let utility = |r: &Candidate| {
                    let gain = r.authors.iter().fold(0u64, |sum, author| {
                        sum.saturating_add(person(author).saturating_mul(
                            match covered.get(author.as_str()) {
                                None => 2,
                                Some(1) => 1,
                                _ => 0,
                            },
                        ))
                    });
                    r.weight.saturating_mul(1 + gain)
                };
                utility(a).cmp(&utility(b)).then_with(|| b.url.cmp(&a.url))
            });
        let Some(best) = best else { break };
        for author in &best.authors {
            *covered.entry(author.as_str()).or_default() += 1;
        }
        selected.push(best.url.clone());
    }
    selected
}

//! GreedyDual Size Frequency with fixed, integer reuse weights.
#[derive(Default)]
pub(crate) struct KeepScorer {
    inflation: u64,
}

impl KeepScorer {
    pub fn inflation(&self) -> u64 {
        self.inflation
    }

    pub fn score(
        &self,
        inflation: u64,
        kind: u64,
        weight: u64,
        accessed_minutes_ago: u64,
        refetch_ms: u64,
        bytes: usize,
    ) -> u64 {
        let base = match class(kind) {
            "profile" => 900,
            "list" => 1000,
            "note" | "article" => 300,
            "repost" => 200,
            _ => 100,
        };
        let weight = match weight {
            0 => 0,
            1..=7 => 250,
            8..=15 => 500,
            16..=31 => 700,
            32..=63 => 900,
            _ => 1000,
        };
        let age = accessed_minutes_ago.checked_ilog2().unwrap_or(0).min(24);
        let value = base * weight * refetch_ms.clamp(150, 6000) / bytes.max(1) as u64;
        inflation.saturating_add(value >> age)
    }

    pub fn advance(&mut self, victim_score: u64) {
        self.inflation = self.inflation.max(victim_score);
    }
}

pub(crate) fn class(kind: u64) -> &'static str {
    match kind {
        0 => "profile",
        1 | 42 | 1111 => "note",
        6 | 16 => "repost",
        7 => "reaction",
        30023 => "article",
        3 | 10000..=19999 | 30000..=30030 => "list",
        _ => "other",
    }
}

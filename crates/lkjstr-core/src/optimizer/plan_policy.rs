use super::{
    features::{Features, Route},
    link::{LinkState, cost_ms},
};

const BUDGETS_MS: [u64; 4] = [250, 250, 250, 250];

#[derive(Clone, Copy)]
pub struct Plan {
    pub fanout: usize,
    pub hedge_delay_ms: u64,
    pub hedge_target: Option<usize>,
    pub limit: u64,
    pub author_chunk: usize,
    pub prefetch_depth: usize,
}

pub fn decide(features: Features, link: LinkState, routes: &[Route], enabled: bool) -> Plan {
    let fanout = if enabled && link.thin() {
        2
    } else if enabled
        && features.focused
        && routes.len() >= 2
        && routes[..2]
            .iter()
            .all(|r| r.useful_per_mille.is_some_and(|share| share < 500))
    {
        3
    } else if enabled
        && link.saturated
        && !features.focused
        && routes
            .first()
            .is_some_and(|r| r.useful_per_mille.is_some_and(|p| p >= 900))
    {
        1
    } else {
        2
    };
    let (primary, others) = routes.split_at(fanout.min(routes.len()));
    let hedge_delay_ms = hedge_delay(link, primary, enabled);
    let bytes = features.avg_event_bytes.max(1);
    let budget = BUDGETS_MS[features.lane.min(3)];
    let limit = if enabled {
        (budget * link.throughput_bps / 1000 / bytes)
            .clamp(if link.very_thin() { 8 } else { 20 }, 200)
            .min(features.relay_limit)
    } else {
        features.relay_limit.min(200)
    };
    let hedge_target = if enabled {
        others
            .iter()
            .take(8usize.saturating_sub(fanout))
            .filter(|r| !r.cooldown && !r.closed_recent)
            .max_by_key(|r| {
                let share = u64::from(r.useful_per_mille.unwrap_or(500));
                let retry = r.eose_ms.unwrap_or(200) * (1000 - share) / 1000;
                let cost = cost_ms(link, limit * bytes, 1, u64::from(!r.online), retry);
                (share * 1_000_000 / cost.max(1), std::cmp::Reverse(r.index))
            })
            .map(|r| r.index)
    } else {
        others.first().map(|r| r.index)
    };
    let author_chunk = if features.profile { 120 } else { 400 };
    let author_chunk = if enabled && link.saturated {
        author_chunk / 2
    } else {
        author_chunk
    };
    let prefetch_depth = if !enabled {
        1
    } else if !features.visible
        || features.hidden
        || features.offline
        || features.save_data
        || features.awaiting_ok
        || features.interaction.active()
        || link.saturated
        || link.thin()
    {
        0
    } else {
        (BUDGETS_MS[3] / cost_ms(link, limit * bytes, 1, 0, 0).max(1)).min(2) as usize
    };
    Plan {
        fanout,
        hedge_delay_ms,
        hedge_target,
        limit,
        author_chunk,
        prefetch_depth,
    }
}

pub fn hedge_delay(link: LinkState, primaries: &[Route], enabled: bool) -> u64 {
    if enabled && link.thin() {
        let observed = primaries
            .iter()
            .filter_map(|route| route.first_event_p75_ms)
            .max()
            .unwrap_or(0);
        return observed
            .saturating_add(link.rtt_ms)
            .max(link.rtt_ms.saturating_mul(2))
            .clamp(400, 4_000);
    }
    if !enabled
        || primaries.is_empty()
        || primaries
            .iter()
            .any(|route| route.first_event_p75_ms.is_none())
    {
        return 400;
    }
    let slowest = primaries
        .iter()
        .filter_map(|route| route.first_event_p75_ms)
        .max()
        .unwrap_or(0);
    slowest.saturating_add(link.rtt_ms).clamp(250, 900)
}

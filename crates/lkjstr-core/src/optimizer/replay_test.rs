//! Modeled native comparisons. No sockets or browser and no live traffic.
use super::{
    features::{Features, Route},
    fixtures_test::{event, trim},
    link::LinkState,
    plan_policy::decide,
    rng::Random,
};
use crate::store::Store;
use std::collections::BTreeSet;

#[derive(Default)]
struct Read {
    first_8: u64,
    first_50: u64,
    reqs: usize,
    bytes: u64,
    dup_bytes: u64,
    hedges: usize,
    recall: usize,
}

fn read(seed: u64, link: LinkState, stage1: bool) -> Read {
    let mut rng = Random::new(seed);
    let warm_routes = [95, 170, 120, 280, 340, 410, 580, 200];
    let mut out = Read::default();
    for page in 0..6 {
        let routes: Vec<_> = warm_routes
            .iter()
            .enumerate()
            .map(|(index, delay)| Route {
                index,
                useful_per_mille: Some(if index == 0 {
                    970
                } else {
                    880 - index as u16 * 55
                }),
                first_event_p75_ms: Some(delay + link.rtt_ms),
                eose_ms: Some(delay + link.rtt_ms + 100),
                online: true,
                ..Default::default()
            })
            .collect();
        // Six groups of 50 newer rows. Each top route also holds older data
        // from the warm cache, while degraded route zero needs an alternate.
        let plan = decide(
            Features {
                avg_event_bytes: 4100,
                ..Default::default()
            },
            link,
            &routes,
            stage1,
        );
        let degraded = page == 3 && seed.is_multiple_of(3);
        let mut arrival: Vec<_> = warm_routes
            .iter()
            .map(|delay| delay / if link.saturated { 1 } else { 3 } + link.rtt_ms + rng.next() % 43)
            .collect();
        if degraded {
            arrival[0] += 620;
        }
        let mut asked: Vec<_> = (0..plan.fanout).collect();
        if asked
            .iter()
            .all(|&index| arrival[index] > plan.hedge_delay_ms)
            && let Some(target) = plan.hedge_target
        {
            arrival[target] += plan.hedge_delay_ms;
            asked.push(target);
            out.hedges += 1;
        }
        asked.sort_unstable_by_key(|&index| arrival[index]);
        let mut unique = BTreeSet::new();
        let mut line_free = 0;
        for index in asked {
            out.reqs += 1;
            let offset = if index == 0 { 0 } else { index * 3 };
            for i in 0..plan.limit as usize {
                let bytes = 3700 + rng.next() % 800;
                out.bytes += bytes;
                line_free =
                    line_free.max(arrival[index]) + (bytes * 1000).div_ceil(link.throughput_bps);
                let row = i + offset;
                if row < 50 && unique.insert(row) {
                    if page == 0 && unique.len() == 8 {
                        out.first_8 = line_free;
                    }
                    if page == 0 && unique.len() == 50 {
                        out.first_50 = line_free;
                    }
                } else {
                    out.dup_bytes += bytes;
                }
            }
        }
        out.recall += unique.len();
    }
    out
}

fn retain(seed: u64, stage1: bool) -> (u64, u64, u64) {
    let mut rng = Random::new(seed);
    let store = Store::with_caps(200, 30);
    let mut store = if stage1 {
        store.weight_retention()
    } else {
        store
    };
    let held = BTreeSet::new();
    let mut reused = Vec::new();
    for n in 1..=600 {
        let author = if n <= 96 { 1 } else { 2 };
        let event = event(n, author, 1, (160 + rng.next() % 2000) as usize);
        if author == 1 {
            reused.push(event.clone());
        }
        store.insert_deferred(event, None);
        if n % 32 == 0 {
            trim(&mut store, &held, &[1]);
        }
    }
    trim(&mut store, &held, &[1]);
    let mut refetch = 0;
    for e in reused {
        if store.get(&e.id).is_none() {
            refetch += crate::store::event_payload_bytes(&e) as u64;
            store.insert_deferred(e, Some("wss://fixture.invalid"));
        }
    }
    (store.ghost_hits(), refetch, store.evictions())
}

#[test]
#[ignore = "manual deterministic metrics; run with --ignored --nocapture"]
fn modeled_native_replay() {
    for (profile, link) in [
        (
            "loopback",
            LinkState {
                throughput_bps: 100_000_000,
                rtt_ms: 2,
                saturated: false,
                samples: 12,
            },
        ),
        (
            "24 Mbps",
            LinkState {
                throughput_bps: 3_000_000,
                rtt_ms: 80,
                saturated: true,
                samples: 12,
            },
        ),
    ] {
        for stage1 in [false, true] {
            let reads: Vec<_> = (1..=30).map(|seed| read(seed, link, stage1)).collect();
            let percentile = |metric: fn(&Read) -> u64| {
                let mut values: Vec<_> = reads.iter().map(metric).collect();
                values.sort_unstable();
                values[22]
            };
            let bytes = reads.iter().map(|r| r.bytes).sum::<u64>() / 30;
            let duplicate_bytes = reads.iter().map(|r| r.dup_bytes).sum::<u64>() / 30;
            let reqs = reads.iter().map(|r| r.reqs).sum::<usize>() as f64 / 30.0;
            let hedges = reads.iter().map(|r| r.hedges).sum::<usize>();
            let recall = reads.iter().map(|r| r.recall).min().unwrap_or(0);
            let (ghosts, refetch, evictions) = (1..=30)
                .map(|seed| retain(seed, stage1))
                .fold((0, 0, 0), |(g, b, e), (ng, nb, ne)| {
                    (g + ng, b + nb, e + ne)
                });
            println!(
                "{profile} {} p75_e1={} p75_first50={} reqs={reqs:.2} bytes={bytes} duplicate_bytes={duplicate_bytes} hedges_total={hedges} min_recall={recall} ghosts={} refetch_bytes={} evictions={}",
                if stage1 { "stage1" } else { "baseline" },
                percentile(|r| r.first_8),
                percentile(|r| r.first_50),
                ghosts / 30,
                refetch / 30,
                evictions / 30
            );
            assert_eq!(recall, 300);
        }
    }
}

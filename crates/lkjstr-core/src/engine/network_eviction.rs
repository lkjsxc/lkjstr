//! A transmitted REQ is a unit of eviction: prefer disposable, cheap wires.
use super::{BTreeMap, Request, filter_to_value};
use std::cmp::Reverse;

// Protect every logical member of a shared envelope, especially visible live
// subscriptions whose large author filters are expensive to retransmit.
pub(super) fn loss(
    requests: &BTreeMap<String, Request>,
    victim: &Request,
) -> (Reverse<u8>, usize, bool, usize, u64) {
    let mut priority = u8::MAX;
    let mut unfinished = 0;
    let mut live = false;
    let mut bytes = 0;
    let mut weight = 0_u64;
    for member in requests.values().filter(|member| {
        member.sent && member.relay == victim.relay && member.wire_id == victim.wire_id
    }) {
        priority = priority.min(member.priority);
        unfinished += usize::from(!member.page_eose);
        live |= member.live;
        bytes += filter_to_value(&member.filter).to_string().len();
        weight = weight.saturating_add(member.weight.min(1_000_000));
    }
    (Reverse(priority), unfinished, live, bytes, weight)
}

// A multi-filter wire is indivisible. Replacing its cheap sibling would also
// replay the large finite follower or exact-ID answer before its first EOSE.
// Leave a nine-second escape hatch for a newly focused urgent read.
pub(super) fn holds_expensive_page(
    requests: &BTreeMap<String, Request>,
    victim: &Request,
    now: u64,
) -> bool {
    requests.values().any(|r| {
        r.sent
            && r.relay == victim.relay
            && r.wire_id == victim.wire_id
            && !r.page_eose
            && now.saturating_sub(r.sent_at) < 9000
            && (r.filter.ids.is_some()
                || (r.filter.kinds.as_deref() == Some(&[3]) && r.filter.tags.contains_key("p")))
    })
}

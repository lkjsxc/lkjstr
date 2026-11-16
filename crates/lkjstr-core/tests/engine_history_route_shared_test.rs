//! Another view at the same cursor cannot erase a completed full predecessor.
mod engine_history_route_support;
use engine_history_route_support::*;
use lkjstr_core::{engine::protocol::Query, store::Store};
use lkjstr_protocol::NostrFilter;
use serde_json::json;

fn plan(f: &mut Fixture, wants: Vec<(String, NostrFilter, Query)>, now: u64) {
    f.network.plan(wants, &Store::new(0), now);
    for url in [A, B, C] {
        if f.network.relays.get(url).is_some_and(|r| r.connecting) {
            f.network.connected(url, now);
        }
    }
}

#[test]
fn another_views_current_routes_do_not_erase_full_predecessor_debt() -> Result {
    let mut f = Fixture::new()?;
    f.network
        .configure(vec![A.into(), C.into(), B.into()], NOW + 2);
    let a = f.initial(A)?;
    let b = f.initial(B)?;
    f.answer(A, &a, &[], NOW + 3)?;
    for at in [100, 90, 80] {
        assert!(
            f.network
                .message(
                    B,
                    &json!(["EVENT", b[1], f.event(at)?]).to_string(),
                    NOW + 5
                )
                .is_some()
        );
    }
    let page = f.next(80);
    let mut other = f.query.clone();
    other.filters.until = Some(80);
    let mut wants = vec![
        ("home".into(), f.head.clone(), f.query.clone()),
        ("other".into(), page.clone(), other),
    ];
    plan(&mut f, wants.clone(), NOW + 1000);
    let mut sent = history(&frames(&mut f.network)?);
    plan(&mut f, wants.clone(), NOW + 1200);
    sent.extend(history(&frames(&mut f.network)?));
    let selected: Vec<_> = sent.iter().map(|(url, _)| url.as_str()).collect();
    assert_eq!(
        selected,
        [A, C],
        "the second view already owns the two current slots"
    );
    for (url, frame) in &sent {
        f.answer(url, frame, &[], NOW + 1250)?;
    }
    f.network
        .message(B, &json!(["EOSE", b[1]]).to_string(), NOW + 2000);
    assert_eq!(f.network.page_cursor(&f.head), Some(80));
    wants.push(("home".into(), page.clone(), f.query.clone()));
    plan(&mut f, wants.clone(), NOW + 2100);
    let mut continued = history(&frames(&mut f.network)?);
    plan(&mut f, wants.clone(), NOW + 2300);
    continued.extend(history(&frames(&mut f.network)?));
    let tail = continued
        .iter()
        .find(|(url, _)| url == B)
        .map(|(_, frame)| frame)
        .ok_or("the current slots of another view discarded B's full predecessor")?;
    assert_eq!(tail[2]["until"], 80);
    assert!(
        !f.network.page_exhausted(&page),
        "short current routes cannot prove the full predecessor exhausted"
    );
    f.answer(B, tail, &[80, 79, 78], NOW + 2400)?;
    assert_eq!(f.network.page_cursor(&page), Some(78));
    let next = f.next(78);
    wants.pop();
    wants.push(("home".into(), next.clone(), f.query.clone()));
    plan(&mut f, wants, NOW + 2600);
    let following = history(&frames(&mut f.network)?);
    let last = following
        .iter()
        .find(|(url, _)| url == B)
        .map(|(_, frame)| frame)
        .ok_or("a demoted full route still owns its next tail")?;
    assert_eq!(last[2]["until"], 78);
    f.answer(B, last, &[78, 77], NOW + 2700)?;
    for (url, frame) in following.iter().filter(|(url, _)| url != B) {
        f.answer(url, frame, &[], NOW + 2702)?;
    }
    assert!(f.network.page_exhausted(&next));
    Ok(())
}

#[test]
fn unavailable_predecessor_yields_a_slot_but_retains_its_original_span() -> Result {
    let mut f = Fixture::full_b()?;
    f.network.disconnected(B, NOW + 2050);
    frames(&mut f.network)?;
    let page = f.next(80);
    f.plan(Some(page.clone()), NOW + 2100);
    let admitted = frames(&mut f.network)?;
    for (url, frame) in admitted
        .iter()
        .filter(|(url, frame)| url == C && frame[0] == "REQ")
    {
        f.answer(url, frame, &[100, 95, 90], NOW + 2150)?;
    }
    f.plan(Some(page.clone()), NOW + 2301);
    let sent = history(&frames(&mut f.network)?);
    let healthy = sent
        .iter()
        .find(|(url, _)| url == C)
        .map(|(_, frame)| frame)
        .ok_or("healthy C must take the unavailable route's ordinary slot")?;
    f.answer(C, healthy, &[80, 75, 70], NOW + 2400)?;
    assert!(f.network.page_finished(&page));
    assert!(!f.network.page_exhausted(&page));
    assert_eq!(f.network.page_cursor(&page), Some(70));
    let next = f.next(70);
    f.plan(Some(next.clone()), NOW + 2600);
    frames(&mut f.network)?;
    f.plan(Some(next.clone()), NOW + 5000);
    let mut recovered = history(&frames(&mut f.network)?);
    f.plan(Some(next.clone()), NOW + 5200);
    recovered.extend(history(&frames(&mut f.network)?));
    let old = recovered
        .iter()
        .find(|(url, _)| url == B)
        .map(|(_, frame)| frame)
        .ok_or("B must resume its retained historical span")?;
    assert_eq!(
        old[2]["until"], 80,
        "B must not borrow C's newer logical page"
    );
    f.answer(B, old, &[80, 79, 78], NOW + 5201)?;
    assert!(!f.network.page_exhausted(&next));
    Ok(())
}

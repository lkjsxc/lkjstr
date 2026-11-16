//! Full preceding history must survive a quality rerank at its actual inclusive cursor.
mod engine_history_route_support;
use engine_history_route_support::*;
use lkjstr_core::{engine::network::Effect, store::Store};
use serde_json::json;

#[test]
fn inclusive_cursor_keeps_full_route_and_delivers_its_unique_tail() -> Result {
    let mut f = Fixture::full_b()?;
    let page = f.next(80);
    f.plan(Some(page.clone()), NOW + 2100);
    let sent = history(&frames(&mut f.network)?);
    assert!(
        sent.len() <= 2,
        "continuation keeps the existing primary route bound"
    );
    assert!(
        !sent.iter().any(|(url, _)| url == A),
        "completed-short A is not requested again"
    );
    let request = sent
        .iter()
        .find(|(url, _)| url == B)
        .map(|(_, frame)| frame)
        .ok_or("full B was discarded at its own inclusive history cursor")?;
    assert_eq!(request[2]["until"], 80);
    assert!(!f.network.page_exhausted(&page));
    f.answer(B, request, &[80, 70], NOW + 2101)?;
    for (url, frame) in sent.iter().filter(|(url, _)| url != B) {
        f.answer(url, frame, &[], NOW + 2103)?;
    }
    assert!(
        f.network.page_exhausted(&page),
        "only the final short tail establishes exhaustion"
    );
    Ok(())
}

#[test]
fn explicit_different_until_can_choose_new_routes() -> Result {
    let mut f = Fixture::full_b()?;
    f.plan(Some(f.next(79)), NOW + 2100);
    let sent = history(&frames(&mut f.network)?);
    let urls: Vec<_> = sent.iter().map(|(url, _)| url.as_str()).collect();
    assert_eq!(urls, [A, C]);
    Ok(())
}

#[test]
fn changed_authors_do_not_inherit_previous_history_authority() -> Result {
    let mut f = Fixture::full_b()?;
    let old = f.initial(B)?;
    let mut replacement = f.next(80);
    replacement.authors = Some(vec!["f".repeat(64)]);
    f.network.plan(
        vec![("home".into(), replacement, f.query.clone())],
        &Store::new(0),
        NOW + 2100,
    );
    for url in [A, B, C] {
        if f.network.relays.get(url).is_some_and(|r| r.connecting) {
            f.network.connected(url, NOW + 2100);
        }
    }
    let sent = history(&frames(&mut f.network)?);
    assert!(!sent.iter().any(|(url, _)| url == B));
    assert!(
        f.network
            .message(
                B,
                &json!(["EVENT", old[1], f.event(70)?]).to_string(),
                NOW + 2101
            )
            .is_none()
    );
    Ok(())
}

#[test]
fn revoked_read_permission_releases_full_route_debt() -> Result {
    let mut f = Fixture::full_b()?;
    let old = f.initial(B)?;
    f.network.known.get_mut(B).ok_or("configured B")?.read = false;
    f.plan(Some(f.next(80)), NOW + 2100);
    let sent = frames(&mut f.network)?;
    assert!(
        sent.iter()
            .any(|(url, frame)| url == B && frame[0] == "CLOSE")
    );
    assert!(
        !sent
            .iter()
            .any(|(url, frame)| url == B && frame[0] == "REQ")
    );
    assert!(
        f.network
            .message(
                B,
                &json!(["EVENT", old[1], f.event(70)?]).to_string(),
                NOW + 2101
            )
            .is_none()
    );
    Ok(())
}

#[test]
fn closing_last_view_releases_history_and_live_head() -> Result {
    let mut f = Fixture::full_b()?;
    f.plan(Some(f.next(80)), NOW + 2100);
    let outstanding = frames(&mut f.network)?;
    f.network.plan(vec![], &Store::new(0), NOW + 2200);
    assert_eq!(f.network.request_progress("home"), (0, 0));
    assert!(
        f.network
            .drain_effects()
            .iter()
            .any(|e| matches!(e, Effect::Disconnect(_)))
    );
    for (url, frame) in outstanding
        .iter()
        .chain(f.initial.iter())
        .filter(|(_, frame)| frame[0] == "REQ")
    {
        assert!(
            f.network
                .message(
                    url,
                    &json!(["EVENT", frame[1], f.event(70)?]).to_string(),
                    NOW + 2201
                )
                .is_none()
        );
    }
    Ok(())
}

#[test]
fn other_empty_routes_cannot_complete_an_unanswered_full_tail() -> Result {
    let mut f = Fixture::full_b()?;
    let page = f.next(80);
    f.plan(Some(page.clone()), NOW + 2100);
    let sent = history(&frames(&mut f.network)?);
    for (url, frame) in sent.iter().filter(|(url, _)| url != B) {
        f.answer(url, frame, &[], NOW + 2101)?;
    }
    assert!(
        !f.network.page_exhausted(&page),
        "empty replacement routes cannot prove B's unqueried history exhausted"
    );
    Ok(())
}

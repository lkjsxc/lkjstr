//! Harness-only deterministic stop boundary. No private body or key leaves the Host.
use super::*;
use lkjstr_core::engine::wire::actions::Action as A;
use serde::Serialize;

pub(in crate::worker) fn prime(h: &mut Host, account: &str) -> Result<(), JsValue> {
    if h.stopped || h.accounts.entries.len() != 1 || h.sessions.len() != 1 {
        return Err("fresh owned stop fixture required".into());
    }
    sync(h);
    let client = *h.sessions.keys().next().ok_or("fixture client missing")?;
    let epoch = lifetime::lease(h, client, account)?;
    let peer = lkjstr_protocol::public_key_from_secret(&lkjstr_protocol::generate_secret_key())
        .map_err(|_| JsValue::from_str("fixture identity failed"))?;
    let draft = dm::Draft {
        recipients: vec![peer],
        text: "private stop fixture".into(),
        reply_to: None,
        subject: None,
        emoji: None,
    };
    let rumor = dm::draft(account, &draft, 1)?;
    h.dm.inbox.insert(account, rumor.clone())?;
    input::input(
        h,
        client,
        &I::Act {
            req: "stop-queued-send".into(),
            action: A::DmSend {
                account: account.into(),
                draft: draft.clone(),
            },
        },
    );
    delivery::prime_stop_probe(h, client, account.into(), epoch, rumor)?;
    drafts::input(
        h,
        client,
        &I::Act {
            req: "stop-queued-draft".into(),
            action: A::DmDraftSave {
                account: account.into(),
                tab: "stop-fixture".into(),
                expected: None,
                state: dm::drafts::State {
                    draft,
                    failed: vec![],
                },
            },
        },
    );
    h.receive(
        client,
        account_input(account, "stop-queued-account"),
        Default::default(),
    );
    let loaded = h.loaded;
    h.loaded = false;
    h.receive(
        client,
        account_input(account, "stop-queued-startup"),
        Default::default(),
    );
    h.loaded = loaded;
    h.engine.private_lists.insert(
        "stop-private-list".into(),
        vec![vec!["word".into(), "private stop policy".into()]],
    );
    if let Some(session) = h.sessions.get(&client) {
        session.borrow_mut().queries.insert(
            "stop-private-projection".into(),
            lkjstr_core::engine::wire::queries::Query {
                source: "mutes".into(),
                account: Some(account.into()),
                text: Some("private stop projection".into()),
                ..Default::default()
            },
        );
    }
    Ok(())
}
fn account_input(account: &str, req: &str) -> I {
    I::Act {
        req: req.into(),
        action: A::AccountUnlock {
            pubkey: account.into(),
            password: lkjstr_core::engine::accounts::secret::SecretText::new(
                "stop owned password".into(),
            ),
        },
    }
}
pub(in crate::worker) fn stale_input(h: &mut Host, account: &str) -> Result<(), JsValue> {
    if !h.stopped {
        return Err("stopped fixture required".into());
    }
    let value = serde_json::json!({"t":"act", "req":"stop-queued-late-value", "action":{
        "a":"account.unlock", "pubkey":account, "password":"stop owned password"
    }})
    .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
    .map_err(|_| JsValue::from_str("stop input encoding failed"))?;
    h.receive_value(0, value);
    h.receive(
        0,
        account_input(account, "stop-queued-late-decoded"),
        Default::default(),
    );
    let loaded = h.loaded;
    h.loaded = false;
    h.receive(
        0,
        account_input(account, "stop-queued-late-startup"),
        Default::default(),
    );
    h.loaded = loaded;
    h.scope.direct(
        0,
        &Session::failure("stop-queued-late-effect".into(), "internal"),
    );
    Ok(())
}
pub(in crate::worker) fn counts(h: &Host, account: &str) -> Result<JsValue, JsValue> {
    let (draft_jobs, archive_keys, archive_transactions) = drafts::stop_probe(h);
    let snapshot = h.dm.inbox.snapshot(
        &dm::Query {
            account: account.into(),
            ..Default::default()
        },
        "cache",
        None,
        false,
    );
    // One generated conversation is primed, without exposing its identity or body.
    let value = serde_json::json!({
        "stopped": h.stopped,
        "decryptedConversations": snapshot.conversations.len(),
        "queuedSends": h.dm.tasks.iter().filter(|(t, _)| matches!(t, Task::Send { .. })).count(),
        "sendingRumors": delivery::stop_probe(h),
        "draftJobs": draft_jobs, "archiveKeys": archive_keys,
        "archiveTransactions": archive_transactions,
        "signerReads": h.dm.signers.gate.reads().len(),
        "cryptoRequests": h.dm.crypto.len(),
        "authorizedPrivateAccounts": h.dm.access.values().filter(|(ok, _)| *ok).count(),
        "hostAccounts": h.accounts.entries.len(),
        "queuedAccountActions": h.account_tasks.len(), "startupInputs": h.startup.len(),
        "privateLists": h.engine.private_lists.len(), "clientSessions": h.sessions.len(),
        "clientQueries": h.sessions.values().map(|s| s.borrow().queries.len()).sum::<usize>(),
        "timer": usize::from(h.schedule.is_armed()), "sockets": h.sockets.len(),
    });
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|_| JsValue::from_str("stop probe encoding failed"))
}

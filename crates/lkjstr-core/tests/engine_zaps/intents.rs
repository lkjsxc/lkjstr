#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::engine::zaps::*;
use serde_json::{Value, json};

#[test]
fn exact_signed_request_is_only_put_in_the_http_callback() {
    let (store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    assert_eq!(prepared.event.kind, 9734);
    let (callback, json) = prepared.callback(&store, &signed(&prepared), 100).unwrap();
    let url = url::Url::parse(&callback).unwrap();
    let pairs: Vec<_> = url.query_pairs().collect();
    assert!(pairs.iter().any(|(k, v)| k == "nostr" && v == &json));
    assert!(pairs.iter().any(|(k, v)| k == "amount" && v == "21000"));
    assert!(
        pairs
            .iter()
            .any(|(k, v)| k == "lnurl" && v == &prepared.provider.binding.lnurl)
    );
    let mut different = prepared.event.clone();
    different.content.push('!');
    let different = different.sign(&key(1), &[1; 32]).unwrap();
    assert_eq!(
        prepared.callback(&store, &different, 100),
        Err(Failure::Stale)
    );
}
#[test]
fn valid_mainnet_invoice_returns_an_explicit_unpaid_intent() {
    let (store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let (callback, json, response) = invoice_response(&store, &prepared, 100);
    let result = invoice(&store, &prepared, &json, &callback, &response, 100).unwrap();
    assert_eq!(result.amount_msat, 21_000);
    assert_eq!(result.expires_at, 3601);
    assert_eq!(result.recipient, key(2).public_key());
    assert_eq!(serde_json::to_value(result).unwrap()["state"], "unpaid");
}
#[test]
fn amount_hash_signature_redirect_and_currency_mismatches_are_rejected() {
    let (store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let (callback, json, response) = invoice_response(&store, &prepared, 100);
    for (description, amount, error) in [
        (json.as_str(), "lnbc220n", Failure::Rejected),
        ("other signed request", "lnbc210n", Failure::Rejected),
        (json.as_str(), "lntb210n", Failure::Unsupported),
    ] {
        let mut changed = response.clone();
        changed.body =
            json!({"pr":common::invoices::invoice(description,amount,false)}).to_string();
        assert_eq!(
            invoice(&store, &prepared, &json, &callback, &changed, 100),
            Err(error)
        );
    }
    let mut changed = response.clone();
    let mut data: Value = serde_json::from_str(&changed.body).unwrap();
    let bad = data["pr"].as_str().unwrap().to_owned() + "q";
    data["pr"] = json!(bad);
    changed.body = data.to_string();
    assert_eq!(
        invoice(&store, &prepared, &json, &callback, &changed, 100),
        Err(Failure::Rejected)
    );
    let mut changed = response;
    changed.final_url.push('x');
    assert_eq!(
        invoice(&store, &prepared, &json, &callback, &changed, 100),
        Err(Failure::Network)
    );
}
#[test]
fn expired_invoice_and_provider_evidence_fail_without_payment() {
    let (store, mut providers, value) = setup();
    let work = providers
        .sync(&store, &[key(2).public_key()], 3500)
        .unwrap();
    let job = work.fetch.first().unwrap();
    assert!(providers.complete(&store, job, Ok(response(&job.binding, 4)), 3500));
    let prepared = prepared(&store, &providers, &value, 3500);
    let (callback, json, response) = invoice_response(&store, &prepared, 3500);
    assert_eq!(
        invoice(&store, &prepared, &json, &callback, &response, 3601),
        Err(Failure::Expired)
    );
    assert_eq!(
        invoice(&store, &prepared, &json, &callback, &response, 4100),
        Err(Failure::Stale)
    );
}
#[test]
fn success_actions_are_data_and_cross_domain_or_unknown_actions_fail() {
    let (store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let (callback, json, original) = invoice_response(&store, &prepared, 100);
    for (action, accepted) in [
        (json!({"tag":"message","message":"received"}), true),
        (
            json!({"tag":"url","description":"receipt","url":"https://ln.test/receipt"}),
            true,
        ),
        (
            json!({"tag":"url","description":"receipt","url":"https://other.test/receipt"}),
            false,
        ),
        (json!({"tag":"aes","ciphertext":"anything"}), false),
    ] {
        let mut response = original.clone();
        let mut data: Value = serde_json::from_str(&response.body).unwrap();
        data["successAction"] = action;
        response.body = data.to_string();
        assert_eq!(
            invoice(&store, &prepared, &json, &callback, &response, 100).is_ok(),
            accepted
        );
    }
}

#[test]
fn profile_replacement_during_signing_or_http_revokes_only_the_pending_intent() {
    let (mut store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let (callback, json, response) = invoice_response(&store, &prepared, 100);
    profile(&mut store, 2, "alice@other.test", 2);
    assert_eq!(
        prepared.callback(&store, &signed(&prepared), 101),
        Err(Failure::Stale)
    );
    assert_eq!(
        invoice(&store, &prepared, &json, &callback, &response, 101),
        Err(Failure::Stale)
    );
}

#[test]
fn invoice_hash_cannot_commit_to_bytes_that_were_not_in_the_callback() {
    let (store, providers, value) = setup();
    let prepared = prepared(&store, &providers, &value, 100);
    let (callback, json, mut response) = invoice_response(&store, &prepared, 100);
    let equivalent = format!("{json} ");
    response.body = json!({
        "pr": common::invoices::invoice(&equivalent, "lnbc210n", false), "routes": []
    })
    .to_string();
    assert_eq!(
        invoice(&store, &prepared, &equivalent, &callback, &response, 100),
        Err(Failure::Rejected)
    );
}

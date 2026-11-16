//! Loopback NIP-46 fixture signer. Outputs public keys and encrypted events only.
use lkjstr_nips::{keys::SecretKey, nip44};
use lkjstr_protocol as p;
#[path = "support/crypto.rs"]
mod crypto;
use serde_json::{Value, json};
use std::io::{self, BufRead};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let secret = p::generate_secret_key();
    let key = SecretKey::from_bytes(*secret.as_bytes())?;
    println!("{}", json!({"pubkey":key.public_key()}));
    for line in io::stdin().lock().lines() {
        let input: Value = serde_json::from_str(&line?)?;
        if let Some(fixture) = input.get("fixture") {
            let unsigned: p::UnsignedNostrEvent = serde_json::from_value(fixture.clone())?;
            if unsigned.pubkey != key.public_key() {
                return Err("wrong fixture author".into());
            }
            let event =
                p::sign_event_with_secret_hex(&unsigned, &p::bytes_to_hex(secret.as_bytes()))
                    .map_err(|_| "fixture signing failed")?;
            println!("{}", serde_json::to_string(&event)?);
            continue;
        }
        let event: p::NostrEvent = serde_json::from_value(input["event"].clone())?;
        if !matches!(p::verify_event(&event), p::VerificationResult::Ok(_)) {
            return Err("invalid RPC event".into());
        }
        let peer = p::hex_to_bytes(&event.pubkey)?
            .try_into()
            .map_err(|_| "invalid peer")?;
        let conversation = nip44::conversation_key(&key, &peer)?;
        let request: Value = serde_json::from_str(&nip44::decrypt(&event.content, &conversation)?)?;
        let method = request["method"].as_str().ok_or("missing method")?;
        let authorized = (method != "connect"
            || !input["require_secret"].as_bool().unwrap_or(false)
            || request["params"][1] == "fixture-authorization")
            && !(method == "sign_event" && input["refuse_sign"].as_bool().unwrap_or(false));
        let result = match Some(method) {
            Some("connect") => "ack".to_owned(),
            Some("get_public_key") => key.public_key(),
            Some("nip44_encrypt" | "nip44_decrypt" | "nip04_decrypt") => crypto::crypt(
                secret.as_bytes(),
                method,
                request["params"][0].as_str().ok_or("missing peer")?,
                request["params"][1].as_str().ok_or("missing data")?,
            )?,
            Some("sign_event") => {
                let unsigned: p::UnsignedNostrEvent =
                    serde_json::from_str(request["params"][0].as_str().ok_or("missing event")?)?;
                serde_json::to_string(
                    &p::sign_event_with_secret_hex(&unsigned, &p::bytes_to_hex(secret.as_bytes()))
                        .map_err(|_| "signing failed")?,
                )?
            }
            _ => return Err("unsupported RPC".into()),
        };
        let nonce = p::generate_secret_key();
        let content = nip44::encrypt(
            &if authorized {
                json!({"id":request["id"],"result":result})
            } else {
                json!({"id":request["id"],"error":"not authorized"})
            }
            .to_string(),
            &conversation,
            nonce.as_bytes(),
        )?;
        let response = p::sign_event_with_secret_hex(
            &p::UnsignedNostrEvent {
                pubkey: key.public_key(),
                kind: 24133,
                created_at: event.created_at,
                tags: vec![vec!["p".into(), event.pubkey]],
                content,
            },
            &p::bytes_to_hex(secret.as_bytes()),
        )
        .map_err(|_| "signing failed")?;
        println!(
            "{}",
            json!({"event":response,"method":method,"authorized":authorized})
        );
    }
    Ok(())
}

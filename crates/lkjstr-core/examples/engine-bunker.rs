//! Loopback NIP-46 fixture signer. Outputs public keys and encrypted events only.
use lkjstr_nips::{keys::SecretKey, nip44};
use lkjstr_protocol as p;
use serde_json::{Value, json};
use std::io::{self, BufRead};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let secret = p::generate_secret_key();
    let key = SecretKey::from_bytes(*secret.as_bytes())?;
    println!("{}", json!({"pubkey":key.public_key()}));
    for line in io::stdin().lock().lines() {
        let event: p::NostrEvent = serde_json::from_str(&line?)?;
        if !matches!(p::verify_event(&event), p::VerificationResult::Ok(_)) {
            return Err("invalid RPC event".into());
        }
        let peer = p::hex_to_bytes(&event.pubkey)?
            .try_into()
            .map_err(|_| "invalid peer")?;
        let conversation = nip44::conversation_key(&key, &peer)?;
        let request: Value = serde_json::from_str(&nip44::decrypt(&event.content, &conversation)?)?;
        let result = match request["method"].as_str() {
            Some("connect") => "ack".to_owned(),
            Some("get_public_key") => key.public_key(),
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
            &json!({"id":request["id"],"result":result}).to_string(),
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
        println!("{}", serde_json::to_string(&response)?);
    }
    Ok(())
}

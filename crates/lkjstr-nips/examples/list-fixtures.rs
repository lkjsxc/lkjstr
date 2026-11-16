//! Fresh loopback fixture; historical encryption exists only in this test executable.
use aes::cipher::{BlockEncryptMut, KeyIvInit, block_padding::Pkcs7};
use base64::{Engine, engine::general_purpose::STANDARD};
use lkjstr_nips::{
    event::{Event, Tag, UnsignedEvent},
    keys::SecretKey,
    nip04, nip44, nip49, unhex,
};
use serde_json::{Value, json};
use std::io::{self, BufRead, Read};
type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;
fn random<const N: usize>() -> Result<[u8; N]> {
    let mut bytes = [0; N];
    std::fs::File::open("/dev/urandom")?.read_exact(&mut bytes)?;
    Ok(bytes)
}
fn key() -> Result<SecretKey> {
    for _ in 0..16 {
        if let Ok(key) = SecretKey::from_bytes(random()?) {
            return Ok(key);
        }
    }
    Err("fixture entropy failed".into())
}
fn now() -> Result<u64> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs())
}
fn encrypt(key: &SecretKey, text: &str, old: bool) -> Result<String> {
    if !old {
        return Ok(nip44::encrypt(
            text,
            &nip44::conversation_key(key, &key.public_bytes())?,
            &random()?,
        )?);
    }
    let private = k256::SecretKey::from_slice(key.as_bytes()).map_err(|_| "fixture key")?;
    let mut bytes = [2; 33];
    bytes[1..].copy_from_slice(&key.public_bytes());
    let public = k256::PublicKey::from_sec1_bytes(&bytes).map_err(|_| "fixture peer")?;
    let shared = k256::ecdh::diffie_hellman(private.to_nonzero_scalar(), public.as_affine());
    let iv: [u8; 16] = random()?;
    let cipher = cbc::Encryptor::<aes::Aes256>::new_from_slices(shared.raw_secret_bytes(), &iv)
        .map_err(|_| "fixture cipher")?
        .encrypt_padded_vec_mut::<Pkcs7>(text.as_bytes());
    Ok(format!(
        "{}?iv={}",
        STANDARD.encode(cipher),
        STANDARD.encode(iv)
    ))
}
fn crypt(key: &SecretKey, operation: &str, peer: &str, data: &str) -> Result<String> {
    let peer = unhex::<32>(peer)?;
    if matches!(operation, "nip04.decrypt" | "nip04_decrypt") {
        return Ok(nip04::decrypt(data, key, &peer)?);
    }
    let conversation = nip44::conversation_key(key, &peer)?;
    match operation {
        "nip44.decrypt" | "nip44_decrypt" => Ok(nip44::decrypt(data, &conversation)?),
        "nip44.encrypt" | "nip44_encrypt" => Ok(nip44::encrypt(data, &conversation, &random()?)?),
        _ => Err("unknown fixture crypto".into()),
    }
}
fn list(key: &SecretKey, input: &Value) -> Result<Event> {
    let kind = input["kind"].as_u64().ok_or("fixture kind")?.try_into()?;
    let tags: Vec<Tag> = serde_json::from_value(input["tags"].clone())?;
    let entries: Vec<Tag> = serde_json::from_value(input["entries"].clone())?;
    let content = encrypt(key, &serde_json::to_string(&entries)?, input["old"] == true)?;
    Ok(UnsignedEvent::new(
        key.public_key(),
        input["at"].as_u64().unwrap_or(now()?),
        kind,
        tags,
        content,
    )
    .sign(key, &random()?)?)
}
fn rpc(key: &SecretKey, input: &Value) -> Result<Value> {
    let event: Event = serde_json::from_value(input["rpc"].clone())?;
    event.verify()?;
    let conversation = nip44::conversation_key(key, &unhex::<32>(&event.data.pubkey)?)?;
    let request: Value =
        serde_json::from_str(&nip44::decrypt(&event.data.content, &conversation)?)?;
    let method = request["method"].as_str().ok_or("fixture method")?;
    let error = input["error"]
        .as_str()
        .filter(|_| method.ends_with("_decrypt"));
    let value = match method {
        "connect" => "ack".into(),
        "get_public_key" => key.public_key(),
        "nip44_encrypt" | "nip44_decrypt" | "nip04_decrypt" => crypt(
            key,
            method,
            request["params"][0].as_str().ok_or("fixture peer")?,
            request["params"][1].as_str().ok_or("fixture data")?,
        )?,
        "sign_event" => {
            let unsigned: UnsignedEvent =
                serde_json::from_str(request["params"][0].as_str().ok_or("fixture unsigned")?)?;
            if unsigned.pubkey != key.public_key() {
                return Err("fixture wrong author".into());
            }
            unsigned.sign(key, &random()?)?.to_json()?
        }
        _ => return Err("unknown fixture method".into()),
    };
    let reply = if let Some(url) = input["auth_url"].as_str() {
        json!({"id":request["id"],"result":"auth_url","error":url})
    } else if let Some(error) = error {
        json!({"id":request["id"],"error":error})
    } else {
        json!({"id":request["id"],"result":value})
    };
    let content = nip44::encrypt(&reply.to_string(), &conversation, &random()?)?;
    let event = UnsignedEvent::new(
        key.public_key(),
        event.data.created_at,
        24133,
        vec![vec!["p".into(), event.data.pubkey]],
        content,
    )
    .sign(key, &random()?)?;
    Ok(json!({"event":event,"method":method}))
}
fn main() -> Result {
    let key = key()?;
    let peer = SecretKey::from_bytes(random()?)?;
    let mentioner = SecretKey::from_bytes(random()?)?;
    let at = now()?;
    let note = UnsignedEvent::new(peer.public_key(), at, 1, vec![], "list fixture note")
        .sign(&peer, &random()?)?;
    let profile = UnsignedEvent::new(
        peer.public_key(),
        at,
        0,
        vec![],
        r#"{"name":"public-person-fixture"}"#,
    )
    .sign(&peer, &random()?)?;
    let mute = list(
        &key,
        &json!({"kind":10000,"at":at,"tags":[["word","public-list-fixture"]],
        "entries":[["word","private-list-fixture"],["p",mentioner.public_key()]]}),
    )?;
    let marks = list(
        &key,
        &json!({"kind":10003,"at":at,"tags":[],"entries":[["e",note.id]]}),
    )?;
    let people = list(
        &key,
        &json!({"kind":30000,"at":at,"tags":[["d","fixture"]],
        "entries":[["p",peer.public_key()]],"old":true}),
    )?;
    let mention = UnsignedEvent::new(
        mentioner.public_key(),
        at,
        1,
        vec![vec!["p".into(), key.public_key()]],
        "muted notification fixture",
    )
    .sign(&mentioner, &random()?)?;
    let password = "loopback-list-fixture";
    let encrypted = nip49::encrypt(&key, password, 16, 2, &random()?, &random()?)?.encode()?;
    println!(
        "{}",
        json!({"pubkey":key.public_key(),"key":encrypted,"password":password,
        "peer":peer.public_key(),"note":note.id,"at":at,"events":[note,profile,mention,mute,marks,people]})
    );
    for line in io::stdin().lock().lines() {
        let input: Value = serde_json::from_str(&line?)?;
        let output = if let Some(data) = input.get("list") {
            serde_json::to_value(list(&key, data)?)?
        } else if input.get("rpc").is_some() {
            rpc(&key, &input)?
        } else if let Some(data) = input.get("crypto") {
            json!({"value":crypt(&key,
                data["operation"].as_str().ok_or("fixture operation")?,
                data["peer"].as_str().ok_or("fixture peer")?,
                data["data"].as_str().ok_or("fixture data")?)?})
        } else {
            let unsigned: UnsignedEvent = serde_json::from_value(input)?;
            if unsigned.pubkey != key.public_key() {
                return Err("fixture wrong author".into());
            }
            serde_json::to_value(unsigned.sign(&key, &random()?)?)?
        };
        println!("{output}");
    }
    Ok(())
}

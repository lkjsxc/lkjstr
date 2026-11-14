//! Public signed fixtures for local browser review. No secrets are emitted.
use lkjstr_protocol::{
    EventTemplate, NostrEvent, encode_note, finalize_event, generate_secret_key, reaction_tags,
    reply_tags,
};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let keys = [
        generate_secret_key(),
        generate_secret_key(),
        generate_secret_key(),
    ];
    let sign = |who: usize, kind, at, content: String, tags| -> Result<NostrEvent, &'static str> {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind,
                tags,
                content,
            },
            &keys[who],
        )
        .map_err(|_| "fixture signing failed")
    };
    let mut events = Vec::new();
    for (i, (name, about, color, initial)) in [
        (
            "高橋 葵",
            "海の近くで写真とコード。Rust / Nostr / 散歩。",
            "27598c",
            "葵",
        ),
        (
            "Maya Chen",
            "Building small tools for an open web. Tokyo ↔ Vancouver.",
            "3d7350",
            "M",
        ),
        (
            "佐藤 遥 / Haru",
            "本、コーヒー、分散した未来。Reading between the lines.",
            "9c3a23",
            "遥",
        ),
    ]
    .into_iter()
    .enumerate()
    {
        let svg = format!(
            "<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' fill='%23{color}'/><text x='36' y='49' text-anchor='middle' fill='white' font-size='34'>{initial}</text></svg>"
        );
        events.push(sign(i, 0, now - 3600, json!({"name": name, "display_name": name, "about": about, "picture": format!("data:image/svg+xml,{svg}")}).to_string(), vec![])?);
    }
    let root = sign(0, 1, now - 180, "朝の港は静かでした。画面から少し離れると、考えがまとまる。\nA quiet morning by the water. What are you making today?\nhttps://media.fixture.invalid/harbor.svg\n#日常 #photography".into(), vec![vec!["imeta".into(), "url https://media.fixture.invalid/harbor.svg".into(), "dim 1200x675".into()]])?;
    events.push(root.clone());
    events.push(sign(1, 1, now - 240, "The best tools leave room for thought. Today I removed three buttons and finally understood what the page wanted to say.\n小さく作って、毎日使う。 #design #Rust".into(), vec![])?);
    events.push(sign(
        2,
        1,
        now - 300,
        format!(
            "この視点が好きです。A little space makes all the difference.\nnostr:{}",
            encode_note(&root.id).map_err(|_| "pointer")?
        ),
        vec![],
    )?);
    events.push(sign(
        1,
        1,
        now - 120,
        "Beautiful light. この青、とてもきれい。Where was this taken?".into(),
        reply_tags(&root),
    )?);
    events.push(sign(
        2,
        6,
        now - 360,
        serde_json::to_string(&root)?,
        vec![
            vec!["e".into(), root.id.clone()],
            vec!["p".into(), root.pubkey.clone()],
        ],
    )?);
    events.push(sign(
        1,
        7,
        now - 60,
        "+".into(),
        reaction_tags(&root, None),
    )?);
    events.push(sign(2, 7, now - 50, ":coffee:".into(), {
        let mut tags = reaction_tags(&root, None);
        tags.push(vec![
            "emoji".into(),
            "coffee".into(),
            "https://media.fixture.invalid/coffee.svg".into(),
        ]);
        tags
    })?);
    events.push(sign(0, 1, now - 420, "少し重い話です。休むことも、ものを作る時間の一部だと思う。\nA note about burnout and finding a slower pace.".into(), vec![vec!["content-warning".into(), "Burnout / 心の健康".into()]])?);
    events.push(sign(2, 1, now - 600, "読み返したいノート / Notes to return to\n\n".to_owned() + &"速さだけでなく、立ち止まれる余白を作りたい。A useful workspace remembers the context so we can concentrate on the conversation.\n\n".repeat(12), vec![])?);
    events.push(sign(1, 1, now - 86_400, "Yesterday's field notes: offline-first is a promise you have to keep, especially on the train.\n昨日のメモ。電車の中でも読めること。 #localfirst".into(), vec![])?);
    println!(
        "{}",
        json!({ "events": events, "root": root.id, "pubkey": root.pubkey })
    );
    Ok(())
}

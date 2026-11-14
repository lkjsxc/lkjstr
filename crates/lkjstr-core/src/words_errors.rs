//! Shared interface words.
pub const WORDS: &[(&str, &str)] = &[
    ("r", "r"),
    ("active", "使用中"),
    ("Stored key is invalid.", "保存した鍵を読み込めません。"),
    ("Signing failed.", "署名できませんでした。"),
    (
        "This account cannot sign. Add a key or a signer extension.",
        "このアカウントでは署名できません。鍵か署名拡張機能を追加してください。",
    ),
    (
        "No NIP-07 signer extension found in this browser.",
        "このブラウザーに署名拡張機能（NIP-07）が見つかりません。",
    ),
    (
        "The signer extension refused.",
        "署名拡張機能に断られました。",
    ),
    (
        "The signer did not answer. Try again.",
        "署名拡張機能から応答がありません。もう一度お試しください。",
    ),
    (
        "The signer returned an invalid public key.",
        "署名拡張機能から有効な公開鍵が届きませんでした。",
    ),
    (
        "Could not encode the event.",
        "投稿を準備できませんでした。",
    ),
    (
        "The signer returned no event.",
        "署名した投稿が届きませんでした。",
    ),
    (
        "The reply parent is unavailable. Wait for it to load before replying.",
        "返信先を読み込めません。読み込んでから返信してください。",
    ),
    (
        "The signer changed the requested event or account.",
        "署名拡張機能が投稿の内容かアカウントを変更したため、送信しませんでした。",
    ),
    (
        "The signer returned an invalid event ID or signature.",
        "投稿IDか署名が正しくないため、送信しませんでした。",
    ),
    (
        "Your follow list has not loaded yet, so following now could erase it. Try again in a moment.",
        "フォロー一覧を読み込めていません。一覧を消さないよう、読み込みを待ってからお試しください。",
    ),
    (
        "This recovery includes a tab moved to another workspace. Return it first.",
        "別のワークスペースへ移したタブがあります。先にタブを戻してください。",
    ),
    ("Resize columns", "列の幅を変える"),
    ("Resize rows", "行の高さを変える"),
    ("lkjstr", "lkjstr"),
    ("96 px", "96 px"),
    ("140 px", "140 px"),
    ("180 px", "180 px"),
    ("220 px", "220 px"),
    ("240 px", "240 px"),
    ("⌘K", "⌘K"),
    ("⇧⌘T", "⇧⌘T"),
    ("Alt+,", "Alt+,"),
    ("Alt+-", "Alt+-"),
    ("Alt+.", "Alt+."),
    ("Alt+W", "Alt+W"),
    ("Alt+\\", "Alt+\\"),
    ("Enter", "Enter"),
];

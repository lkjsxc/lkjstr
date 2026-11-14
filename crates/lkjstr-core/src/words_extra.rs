//! Shared interface words.
pub const WORDS: &[(&str, &str)] = &[
    ("Nothing here", "ここには何もありません"),
    (
        "This address does not open a view.",
        "このアドレスに対応する画面はありません。",
    ),
    ("To post, ", "投稿するには、"),
    ("Your secret key.", "秘密鍵です。"),
    (
        " Anyone who sees it controls this account. Store it in a password manager, then hide it.",
        " この鍵を知る人はアカウントを操作できます。パスワード管理アプリに保存してから隠してください。",
    ),
    (
        "No account yet. Create a key, import one, or use a signer extension. You can browse without one.",
        "読むだけならアカウントは不要です。投稿するには鍵を作るか、読み込むか、署名拡張機能を使ってください。",
    ),
    (
        "Keys created or imported here are stored unencrypted in this browser's storage for this site. A signer extension keeps the key out of the page.",
        "ここで作成・読み込みした鍵は、このサイトのブラウザー内に暗号化せず保存します。署名拡張機能を使えば、このページに秘密鍵を渡さずに済みます。",
    ),
    ("Signed in as", "ログインしました"),
    ("Connected extension for", "署名拡張機能につなぎました"),
    ("Created a new key for", "鍵を作成しました"),
    ("key on this device", "この端末の鍵"),
    ("signer extension", "署名拡張機能"),
    ("read only", "閲覧のみ"),
    (
        "Show the secret key so you can back it up",
        "バックアップ用に秘密鍵を表示します",
    ),
    (
        "Uses window.nostr (NIP-07)",
        "署名拡張機能を使います（NIP-07）",
    ),
    (
        "nsec1… to sign, or npub1… to read only",
        "署名するなら nsec1…、読むだけなら npub1…",
    ),
    ("Key to import", "読み込む鍵"),
    ("Your relay list", "自分のリレー一覧"),
    ("Relay", "リレー"),
    ("State", "接続状態"),
    ("Requests", "問い合わせ"),
    ("Latency", "応答時間"),
    ("Events", "受信数"),
    ("Score", "評価"),
    ("needs sign-in", "ログインが必要"),
    ("connected", "接続中"),
    ("not in use", "未使用"),
    ("read and write", "受信・送信"),
    ("read", "受信"),
    ("write", "送信"),
    (
        "lkjstr uses authors' relay lists, prefers useful answers, asks another relay when one is slow, and backs off after failures. Scores are measured on this device.",
        "投稿者のリレー一覧と、この端末で測った応答をもとに接続先を選びます。遅いときは別のリレーに問い合わせ、失敗が続くと間隔を空けます。",
    ),
    (
        "No published relay list (NIP-65) found for the active account, so lkjstr reads from its default relays.",
        "このアカウントの公開リレー一覧（NIP-65）は見つかりませんでした。既定のリレーから読み込みます。",
    ),
    ("Navigation", "移動"),
    ("Workspaces", "ワークスペース"),
    ("Workspace name", "ワークスペース名"),
    ("Unseen activity", "未読の投稿"),
    ("Tabs", "タブ"),
    ("Tab actions", "タブの操作"),
    ("Opening local data…", "この端末のデータを開いています…"),
    (
        "Words, #tags, npub or note links",
        "言葉・#タグ・npub・投稿へのリンク",
    ),
    ("Open note", "投稿を開く"),
    (
        "Search notes cached on this device and on search relays.",
        "この端末に保存した投稿と、検索用リレーの投稿を探します。",
    ),
    (
        "Enter at least two characters to ask search relays.",
        "2文字以上で検索用リレーに問い合わせます。",
    ),
    (
        "Waiting to ask search relays…",
        "検索の問い合わせを待っています…",
    ),
    (
        "No search relay to ask. Cached notes were searched.",
        "検索用リレーがありません。この端末の投稿を探しました。",
    ),
    (
        "No matches yet. Search relays are still being asked.",
        "まだ見つかりません。検索用リレーに問い合わせています。",
    ),
    (
        "Search relays failed or refused this request. Cached notes were searched.",
        "リレーに接続できないか、検索を断られました。この端末の投稿を探しました。",
    ),
    (
        "No matches on this device or the relays we asked.",
        "この端末にも、問い合わせたリレーにも見つかりませんでした。",
    ),
    (
        "Sign in to see notes from people you follow.",
        "フォローした人の投稿を見るにはログインしてください。",
    ),
    (
        "Sign in to see replies, mentions and reactions.",
        "返信や反応を見るにはログインしてください。",
    ),
    ("Waiting for relays…", "リレーの応答を待っています…"),
    ("No relay to ask yet.", "問い合わせ先のリレーがありません。"),
    ("Open Relays", "リレーを開く"),
    (
        "Could not reach any relay for this view.",
        "この画面のリレーに接続できませんでした。",
    ),
    (
        "No follow list found for this account yet. Follow people from their profiles, or browse Global.",
        "フォロー一覧が見つかりません。気になる人のプロフィールからフォローするか、全体の投稿を読んでみてください。",
    ),
    (
        "Nothing from the people you follow yet. Follow people from their profiles, or browse Global.",
        "フォローした人の投稿はまだありません。プロフィールから人をフォローするか、全体の投稿を読んでみてください。",
    ),
    (
        "No replies, mentions or reactions yet.",
        "返信や反応はまだありません。",
    ),
    (
        "No notes from this account on the relays we asked.",
        "問い合わせたリレーに、この人の投稿はありませんでした。",
    ),
    (
        "Relays returned no notes.",
        "リレーから投稿が届きませんでした。",
    ),
    (
        "Looking for this note on relays…",
        "リレーでこの投稿を探しています…",
    ),
    (
        "No relay available to look for this note.",
        "この投稿を探せるリレーがありません。",
    ),
    (
        "Note not found on the relays we asked.",
        "問い合わせたリレーに投稿が見つかりませんでした。",
    ),
    (
        "Relays failed or refused the note lookup.",
        "接続できないか、投稿の問い合わせを断られました。",
    ),
    (
        "This reference has no target event ID.",
        "参照先の投稿IDがありません。",
    ),
    ("Note text", "投稿の本文"),
    ("Write your reply", "返信を書く"),
    ("What's happening?", "いま何をしていますか？"),
    ("Reason (optional)", "理由（任意）"),
    ("Signing…", "署名しています…"),
    (
        "Saved locally; no relay to send to.",
        "この端末に保存しました。送信先のリレーがありません。",
    ),
    (
        "No relay accepted it. Check Relays and try again.",
        "どのリレーにも届きませんでした。接続先を確認して、もう一度お試しください。",
    ),
    ("Follow list", "フォロー一覧"),
    ("Undo (deletion request)", "取り消し（削除の依頼）"),
    ("waiting", "応答待ち"),
    ("accepted", "受信済み"),
];

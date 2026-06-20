# GPT-5.5-Pro Handoff: Shared Feed Runtime Stop Point

作成/更新日時: 2026-06-20
リポジトリ: `/home/lkjsxc/workspace/lkjstr`
ブランチ: `main`
依頼: 「切りの良いところで切り上げ、GPT-5.5-Pro に解決策を考えてもらうため、現状の問題点を含めて伝えたいことを `tmp/` に Markdown でまとめ、コミットも済ませる」

## 2026-06-20 最終追記

この版が最終状態です。初版 handoff 作成後、残っていた coherent slice を検証して小さく commit しました。

最終状態:

- `git status --short`: clean
- handoff 最終更新前の最新 code/docs commit: `9c7a4267 Align cutover ledgers with retained runtime guards`
- この handoff file も最新状態に更新済み
- TypeScript/Svelte 削除完了、Shared feed runtime 完了、Rust/WASM final gate 完走は主張していません

初版 handoff 後に追加で commit したもの:

```text
ff04c4bf Prove Author Context row thread activation
9de95487 Prove deleted feed tab path guards
b23d6c08 Extract event meta copy status helper
925d738c Split retained event content presenters
4097b52e Plan retained mention chip presenters
f4239632 Plan retained emojified text tokens
99d7cad0 Split retained reaction summary presenters
dd4bf42d Split retained event row frame planning
eb607dbc Plan retained event reference presenters
d205ec55 Plan retained event tree row rendering
90cd1d2e Split retained zap panel presenters
bbb10482 Split retained event action presenters
6cfc1b58 Prove retained media status presenters
46acf9fc Document retained event presenter contracts
92fc94f0 Index User Timeline read command helper
7555a1dc Import notification state from source
9c7a4267 Align cutover ledgers with retained runtime guards
```

最終盤で追加検証した代表コマンド:

```sh
PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  pnpm test -- tests/unit/events/event-media-status-presenter.test.ts

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  pnpm test -- tests/unit/notifications

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  pnpm check

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  pnpm check:repo
```

上記 `pnpm test -- ...` は、この repo の Vitest 設定により全 unit suite を実行し、`340` test files / `1132` tests pass を確認しました。`pnpm check` は `svelte-check` 0 errors / 0 warnings でした。

最終盤で実行していないもの:

- `pnpm rust-wasm:quiet`
- `pnpm verify:quiet`
- `pnpm cloudflare:quiet`
- Docker Compose final gate

古い節にある「dirty worktree が残る」前提は、初版作成時点の問題意識です。最終追記時点では該当差分はすべて coherent slice として commit 済みで、worktree は clean です。

## 最重要結論

現在の第一未完了ブロッカーは、引き続き **Shared feed runtime** です。

このリポジトリは browser-first / local-first Nostr workspace です。shipped product runtime はまだ `src/` 配下の SvelteKit/TypeScript を多く含みます。目標は `crates/` 配下の Rust/WASM + Leptos runtime へ slice ごとに parity を証明しながら切り替えることです。サーバー側アカウント、relay proxy、custody service、backend はありません。

初版 handoff で安全に切った slice は、**Custom Request の parser/query 入力境界を追加テストで証明する proof-only slice** でした。最終追記時点では、その後に retained Svelte event presenters、Author Context row activation、deleted path guards、Notification type import、cutover ledger alignment まで検証済み commit として積んでいます。

Custom Request proof-only slice では、実装の挙動変更は意図していません。すでに Rust 側で実装済みだった以下の制約を、focused tests で明示的に固定しました。

- invalid explicit relay は demand を発行しない。
- explicit relay 数上限を超えた入力は拒否する。
- JSON byte cap を parse 前に拒否する。
- search byte cap を拒否する。
- ids/authors/tag values の上限を拒否する。
- `search` filter は exact mode として分類する。
- Custom Request query は user filter の `since` / `until` / `search` / filter-local `limit` を保持し、runtime page size は query-level limit として別に保持する。

この handoff file 自体も最後の commit に含まれます。正確な最新 commit hash は `git log -1 --oneline` で確認してください。

## 絶対に守る制約

- `AGENTS.md` と `docs/agent/README.md` がこの repo の実行契約です。
- No fake product data。placeholder success state も不可です。
- TypeScript/Svelte product code を削除するには、Rust parity、focused tests、ledger evidence、no-import proof が必要です。
- Main-thread code は SQLite/OPFS を直接開かない。product modules は typed repositories だけを呼びます。
- `src` の source files は 200 lines 以下、docs は 300 lines 以下が通常ルールです。この `tmp/` handoff は、ユーザーが「どれだけ長くなっても構いません」と明示した例外として長く書いています。
- 最終追記時点の worktree は clean です。将来 dirty になった場合も、既存変更はユーザーまたは過去作業由来として扱い、勝手に revert しないでください。
- 今回の作業中は複数 slice が混在していたため、今後も **`git add -A` / `git add .` は使わないでください。**
- commit message は Lore protocol。`Tested:` と `Not-tested:` は実際の検証と一致させてください。
- final parity/deletion claim には Docker Compose final gate が必要です。今回そこまでは走っていません。

## まず読むべきファイル

最初にこの順で読んでください。

1. `AGENTS.md`
2. `docs/current-state.md`
3. `docs/agent/README.md`
4. `docs/execution/current-blockers.md`
5. `docs/agent/skills/feed-runtime.md`

Shared feed runtime の基本契約:

- `docs/architecture/feeds/README.md`
- `docs/architecture/feeds/runtime/README.md`
- `docs/architecture/data/feed-surface/README.md`
- `docs/architecture/data/cache-first-feed-pages.md`
- `docs/architecture/data/feed-coverage.md`
- `docs/execution/tasks/shared-feed-view-model.md`
- `docs/execution/tasks/home-feed-slice.md`

Custom Request / Search / Followees / User Timeline の直近作業を見る時:

- `docs/execution/tasks/custom-request-provider-wiring.md`
- `docs/execution/tasks/search-feed-provider-wiring.md`
- `docs/execution/tasks/followees-provider-wiring.md`
- `docs/execution/tasks/user-timeline-provider-wiring.md`
- `crates/lkjstr-app/tests/custom_request_test.rs`
- `crates/lkjstr-app/tests/custom_request_plan_test.rs`
- `crates/lkjstr-app/tests/feed_tool_input_test.rs`
- `crates/lkjstr-ui/src/workspace/custom_request.rs`
- `crates/lkjstr-ui/src/workspace/custom_request_run.rs`
- `crates/lkjstr-ui/src/workspace/search.rs`
- `crates/lkjstr-ui/src/workspace/search_run.rs`
- `crates/lkjstr-ui/src/workspace/search_older.rs`
- `crates/lkjstr-ui/src/workspace/followees.rs`
- `crates/lkjstr-ui/src/workspace/followees_read.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline_read.rs`

Rust feed row/action/content の直近作業を見る時:

- `crates/lkjstr-ui/src/workspace/feed_event_actions.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_action_policy.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_copy_status.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_open.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_open_tests.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_row.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_row_activation.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_content.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_content_plan.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_content_plan_tests.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_link.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_media.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_sensitive.rs`

## 直近の検証済み commit

初版 handoff 直前までの verified commits:

```text
a6127611 Plan Rust feed content row openers
e9098122 Open Rust feed rows with real event actions
d3ea0da4 Prove older loader lease replacement
62db82c5 Release replaced Search query leases
9462b300 Release replaced Followees read leases
43f2b428 Release replaced Custom Request run leases
556b2ddb Prove User Timeline incomplete diagnostics bucket
7eb1189d Explain User Timeline incomplete discovery
2de87a2d Guard retained feed helpers behind Rust island ownership
```

初版 handoff と同じ commit に含めた Custom Request proof slice:

- `crates/lkjstr-app/tests/custom_request_plan_test.rs`
- `crates/lkjstr-app/tests/custom_request_test.rs`
- `crates/lkjstr-app/tests/feed_tool_input_test.rs`
- `tmp/gpt-5.5-pro-handoff-2026-06-20.md`

最終追記時点では、上の slice は `27493871 Prove Custom Request filter bounds` として commit 済みです。その後の commits は冒頭の「2026-06-20 最終追記」に列挙しています。

## 各 commit の意味

### `2de87a2d Guard retained feed helpers behind Rust island ownership`

- Rust island ownership の境界に合わせ、retained feed helper の扱いを安全側に寄せた commit。
- ここから Shared feed runtime 周辺の小 slice 切り出しを継続しています。

### `7eb1189d Explain User Timeline incomplete discovery`

- User Timeline incomplete discovery を route evidence から説明する `status_detail` を Rust app model に追加しました。
- `incomplete-user-timeline-discovery` unavailable row reason を追加しました。
- Leptos User Timeline read lease cleanup helper を追加しました。

### `556b2ddb Prove User Timeline incomplete diagnostics bucket`

- `incomplete-user-timeline-discovery` Stats bucket mapping を wasm/browser test で証明しました。
- `record_user_timeline_model_for_test` を debug/test hook として公開しました。

### `43f2b428 Release replaced Custom Request run leases`

- Custom Request run-command lease cleanup helper を追加しました。
- replaced/provider-unavailable run が active lease を release することを focused tests で証明しました。

### `9462b300 Release replaced Followees read leases`

- Followees initial/retry read-command の active provider lease を `FolloweesReadController` に移しました。
- replaced read / provider unavailable / unmount cleanup で active lease を release することを focused tests で証明しました。

### `62db82c5 Release replaced Search query leases`

- Search run / older query の active lease を controller helper に移しました。
- replaced run / provider unavailable / cleanup の focused tests を通しました。

### `d3ea0da4 Prove older loader lease replacement`

- Global / Notifications / Thread older loader の replaced lease release と provider unavailable cleanup を tests-only で証明しました。
- 実装変更なしの proof slice です。

### `e9098122 Open Rust feed rows with real event actions`

- Rust feed rows に real event action availability と row open activation の policy を追加しました。
- local action controls / copy status / event-row open policy / unavailable row no-op guard を tests で証明しました。
- `web-sys` の `Node` feature を追加しました。
- `docs/current-state.md` も該当範囲だけ更新しました。

### `a6127611 Plan Rust feed content row openers`

- Rust feed content の link/media/sensitive controls と row opener の境界を plan helper に分けました。
- content local target は row activation を奪わず、link/media/sensitive control は local action として扱う policy を tests で固定しました。
- custom emoji fallback と content row open target の proof を追加しました。

## 今回の Custom Request proof-only slice

### 目的

Custom Request はユーザー入力 JSON から Nostr filters / explicit relay list を作るため、Shared feed runtime の中でも入力境界の失敗が feed demand の過剰発行や silent failure に直結します。

今回の目的は、既存実装に対して以下を証明することでした。

- invalid explicit relay が runtime demand に進まない。
- explicit relay 数 / JSON size / search size / ids / authors / tag values が bounded である。
- search filter は exact request として分類される。
- Custom Request query planner が user filter の意味を壊さない。

### 変更ファイル

- `crates/lkjstr-app/tests/custom_request_plan_test.rs`
- `crates/lkjstr-app/tests/custom_request_test.rs`
- `crates/lkjstr-app/tests/feed_tool_input_test.rs`
- `tmp/gpt-5.5-pro-handoff-2026-06-20.md`

### 追加した代表テスト

- `custom_request_run_rejects_invalid_explicit_relay_without_demand`
- `custom_request_classifies_search_filters_as_exact`
- `custom_request_rejects_too_many_author_values`
- `custom_request_rejects_too_many_tag_values`
- `custom_request_rejects_search_above_byte_cap`
- `custom_request_rejects_json_above_byte_cap_before_parsing`
- `custom_request_rejects_too_many_explicit_relays`
- `custom_request_rejects_invalid_explicit_relay_url`
- `custom_request_query_preserves_user_filter_bounds`

### 実行済み focused verification

```sh
PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  rustfmt --edition 2024 --check \
  crates/lkjstr-app/tests/custom_request_plan_test.rs \
  crates/lkjstr-app/tests/custom_request_test.rs \
  crates/lkjstr-app/tests/feed_tool_input_test.rs

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  cargo test -p lkjstr-app custom_request

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  cargo test -p lkjstr-app feed_tool_input
```

結果:

- rustfmt check: pass
- `cargo test -p lkjstr-app custom_request`: pass
- `cargo test -p lkjstr-app feed_tool_input`: pass
- 対象 test files は line limit 内です。

初版 Custom Request proof commit では、focused tests に加えて以下も通しました。commit message の `Tested:` は実行済み内容に合わせています。

```sh
PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  cargo run -p lkjstr-xtask -- check-docs

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  cargo run -p lkjstr-xtask -- check-lines

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  pnpm check:repo

git diff --cached --check
```

## すでに通した主な verification

この session で pass したものの抜粋です。

### User Timeline incomplete discovery

```sh
cargo test -p lkjstr-app user_timeline
cargo test -p lkjstr-ui user_timeline
rustfmt --edition 2024 --check ...
pnpm exec prettier --check ...
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --check
git diff --cached --check
```

### User Timeline Stats browser proof

```sh
rustfmt --edition 2024 --check \
  crates/lkjstr-web/src/user_timeline_stats.rs \
  crates/lkjstr-web/src/lib.rs \
  crates/lkjstr-web/tests/user_timeline_island_test.rs

wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-d553f1d224c55714/chromedriver \
  crates/lkjstr-web --test user_timeline_island_test

cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --check
git diff --cached --check
```

### Custom Request run lease

```sh
cargo test -p lkjstr-ui custom_request
rustfmt --edition 2024 --check --config skip_children=true \
  crates/lkjstr-ui/src/workspace/custom_request.rs \
  crates/lkjstr-ui/src/workspace/custom_request_run.rs \
  crates/lkjstr-ui/src/workspace/mod.rs
pnpm exec prettier --check crates/lkjstr-ui/src/workspace/README.md
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --cached --check
```

### Followees read leases

```sh
rustfmt --edition 2024 --check --config skip_children=true \
  crates/lkjstr-ui/src/workspace/followees.rs \
  crates/lkjstr-ui/src/workspace/followees_read.rs
cargo test -p lkjstr-ui followees
pnpm exec prettier --check \
  crates/lkjstr-ui/src/workspace/README.md \
  docs/execution/tasks/followees-provider-wiring.md \
  tmp/gpt-5.5-pro-handoff-2026-06-20.md
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --cached --check
```

### Search query leases

```sh
rustfmt --edition 2024 --check --config skip_children=true \
  crates/lkjstr-ui/src/workspace/search.rs \
  crates/lkjstr-ui/src/workspace/search_run.rs \
  crates/lkjstr-ui/src/workspace/search_older.rs \
  crates/lkjstr-ui/src/workspace/mod.rs
cargo test -p lkjstr-ui search
pnpm exec prettier --check \
  crates/lkjstr-ui/src/workspace/README.md \
  docs/execution/tasks/search-feed-provider-wiring.md
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --cached --check
```

### Older loader lease replacement

```sh
rustfmt --edition 2024 --check --config skip_children=true \
  crates/lkjstr-ui/src/workspace/global_older.rs \
  crates/lkjstr-ui/src/workspace/notifications_older.rs \
  crates/lkjstr-ui/src/workspace/thread_older.rs
cargo test -p lkjstr-ui older
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --cached --check
```

### Rust feed rows/actions/content

```sh
rustfmt --edition 2024 --check --config skip_children=true \
  crates/lkjstr-ui/src/workspace/feed_event_actions.rs \
  crates/lkjstr-ui/src/workspace/feed_event_actions_tests.rs \
  crates/lkjstr-ui/src/workspace/feed_event_action_policy.rs \
  crates/lkjstr-ui/src/workspace/feed_event_copy_status.rs \
  crates/lkjstr-ui/src/workspace/feed_event_open.rs \
  crates/lkjstr-ui/src/workspace/feed_event_open_tests.rs \
  crates/lkjstr-ui/src/workspace/feed_event_row.rs \
  crates/lkjstr-ui/src/workspace/feed_event_row_activation.rs
cargo test -p lkjstr-ui feed_event
cargo check -p lkjstr-ui --target wasm32-unknown-unknown
pnpm exec prettier --check \
  crates/lkjstr-ui/src/workspace/README.md \
  docs/agent/skills/feed-runtime.md \
  docs/current-state.md
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --cached --check
```

and:

```sh
rustfmt --edition 2024 --check --config skip_children=true \
  crates/lkjstr-ui/src/workspace/feed_event_content.rs \
  crates/lkjstr-ui/src/workspace/feed_event_content_tests.rs \
  crates/lkjstr-ui/src/workspace/feed_event_content_plan.rs \
  crates/lkjstr-ui/src/workspace/feed_event_content_plan_tests.rs \
  crates/lkjstr-ui/src/workspace/feed_event_link.rs \
  crates/lkjstr-ui/src/workspace/feed_event_media.rs \
  crates/lkjstr-ui/src/workspace/feed_event_sensitive.rs
cargo test -p lkjstr-ui feed_event
cargo check -p lkjstr-ui --target wasm32-unknown-unknown
pnpm exec prettier --check crates/lkjstr-ui/src/workspace/README.md
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
pnpm check:repo
git diff --cached --check
```

Known caveats:

- `rustfmt --check` without `--config skip_children=true` on workspace modules may recurse into sibling files and report unrelated formatting noise. Prefer explicit file list plus `--config skip_children=true` for module-split slices.
- pnpm emits Node engine warning: project wants Node `>=24.0.0`; environment is Node `v22.22.3`. `pnpm check:repo` has still passed under this warning.
- Successful wasm-pack chromedriver path was `/home/lkjsxc/.cache/.wasm-pack/chromedriver-d553f1d224c55714/chromedriver`.

## まだ主張してはいけないこと

Do not claim:

- Shared feed runtime 全体の完了。
- Followees runtime parity 全体の完了。
- Search runtime parity 全体の完了。
- Custom Request runtime parity 全体の完了。
- User Timeline runtime parity 全体の完了。
- Author Context runtime parity 全体の完了。
- TypeScript/Svelte feed surface 全体の削除完了。
- `src/lib/follow-graph` deletion proof 完了。
- `src/lib/components/events/*` / shared event renderer parity 完了。
- Rust/WASM quiet gate の最新完走。
- `pnpm verify:quiet` / `pnpm cloudflare:quiet` の pass。
- Docker Compose final gate の pass。
- future dirty worktree 全体の正当性。

## 現在の中心問題

### 1. Shared feed runtime はまだ巨大な途中状態

`docs/execution/current-blockers.md` の第一未完了 queue は Shared feed runtime です。

すでに証明済みの enabling proof は増えていますが、残りはまだ broad です。典型的には:

- shared feed rows / event rendering の parity。
- Rust Leptos surface と retained Svelte host glue の境界。
- older controls / query controls / run controls の real provider handler 化。
- Search / Custom Request / Followees / User Timeline / Author Context などの read/run cleanup proof の横展開。
- deletion ledger に進めるための no-import proof。
- final gates。

### 2. worktree は clean だが、次の slice はまだ broad

初版 handoff 時点で混ざっていた以下の dirty slice は、最終追記時点では分割して commit 済みです。

- Web Author Context browser test/readme slice。
- Svelte `src/lib/components/events/*` presenter/component 分割。
- TS tests under `tests/unit/events/*` の presenter/plan regression proof。
- cutover ledgers and task docs の retained runtime guard wording update。
- `tests/unit/repo-deleted-paths.test.ts` の no-import/deletion guard proof。
- `src/lib/tabs/notifications/notification-list-state.ts` の type-only import cleanup。

次の agent は最初に:

```sh
git status --short
git diff --stat
```

を見て、clean であることを確認してください。新しく差分を作る場合は、引き続き 1 slice ずつ explicit staging してください。

### 3. docs は最終追記時点で同期済みだが、完了宣言ではない

`docs/current-state.md`, cutover ledgers, task docs の残差分は `9c7a4267` で commit 済みです。

この docs commit は以下の範囲だけを主張します。

- product-source no-import guard と full deletion proof を明確に分ける。
- Custom Request / Profile / Thread / Search / Follow Graph などの retained helper は残っている。
- deletion gate / final gate はまだ open。

今後 docs を触る場合も、source/test evidence と同じ slice で narrow に更新してください。

### 4. final gates は未完走

今回の verified claims は focused / repo-level checks までです。

未実行:

- `pnpm rust-wasm:quiet` の最新全体完走
- `pnpm verify:quiet`
- `pnpm cloudflare:quiet`
- Docker Compose final gate

Shared runtime parity/deletion claim をするなら、`docs/operations/verification.md` の final gate に戻ってください。

### 5. Node engine mismatch がある

環境では pnpm が Node engine warning を出します。

```text
project wants Node >=24.0.0
current environment is Node v22.22.3
```

`pnpm check:repo` はこの warning の上で pass していますが、browser/toolchain 差が疑わしい時は Node version を前提として疑ってください。

### 6. wasm browser tests は chromedriver path を固定すると通しやすい

成功済み chromedriver:

```text
/home/lkjsxc/.cache/.wasm-pack/chromedriver-d553f1d224c55714/chromedriver
```

User Timeline island test はこの path で pass しました。

## GPT-5.5-Pro に考えてほしいこと

### A. まず clean 状態と最新 commit 境界を確認する

最終追記時点の worktree は clean です。まず次を確認してください。

1. `git status --short` が空であること。
2. `git log --oneline -20` で `27493871` 以降の stop-and-commit sequence を把握すること。
3. `docs/execution/current-blockers.md` の第一未完了 blocker がまだ Shared feed runtime であること。
4. 次に作る差分は 1 behavior / 1 proof / 1 docs alignment に分けること。

### B. 次の安全な slice 候補

候補は複数ありますが、次の順で考えるとよいです。

1. Rust shared event renderer parity:
   - retained Svelte presenter proof は増えましたが、Rust shared renderer parity 全体は未完了です。
   - Rust/Leptos 側に同等の behavior proof を移す方針を検討してください。
2. Shared feed runtime deletion prerequisites:
   - product-source no-import guard は一部ありますが、full deletion proof と final gates は未完了です。
   - guard を増やす時は、実際に product import が消えた entry だけに限定してください。
3. Rust/WASM focused gates:
   - `pnpm rust-wasm:quiet` は直近で未実行です。
   - final claim ではなく、次の implementation slice の前提確認として走らせる価値があります。
4. Surface-specific parity:
   - Search / Custom Request / Profile / Thread / Notifications / Followees / User Timeline は、Rust island proof が増えていても broader parity は open です。
   - 1 surface の 1 runtime edge だけを選んで proof を追加してください。

### C. `src/lib/components/events/*` の大規模変更は特に注意

初版 handoff 時点で多数の Svelte components と TS presenter/tests が dirty でしたが、最終追記時点では小分け commit 済みです。

危険な点:

- UI behavior regression が出やすい。
- source line limit 200 に触れやすい。
- Rust shared renderer parity と Svelte retained behavior の境界が混ざりやすい。
- tests は多いが、browser visual/interaction proof が不足しがち。

ここを触るなら:

- 1 component / 1 presenter / 1 behavior proof に分割。
- no fake data rule を守る。
- action availability は real callback/action がある場合だけ表示する。
- unavailable/no-op UI を silent success にしない。

### D. no-import/deletion proof は急がない

初版 handoff 時点では no-import guard や deletion-ledger wording が dirty に見えていましたが、最終追記時点では narrow commit 済みです。TypeScript deletion は引き続き最後の証明です。

守るべき順序:

1. Rust parity 実装
2. Focused tests
3. Browser/wasm proof where needed
4. Docs/ledger evidence
5. No-import proof
6. Delete old TS/Svelte path
7. Final gates

この順序を飛ばして docs の「removed」や ledger の deletion status だけ進めないでください。

## 最終 worktree summary

最終追記前の確認では `git status --short` は空でした。初版 handoff 時点で modified / untracked だった files は、以下の coherent commits に分割済みです。

- `ff04c4bf`: Author Context row の Thread activation browser proof。
- `9de95487`: deleted feed tab path guard proof。
- `b23d6c08`: retained event meta copy-status helper 抽出。
- `925d738c`: retained event content presenter split。
- `4097b52e`: mention chip presenter planning。
- `f4239632`: emojified text token planning。
- `99d7cad0`: reaction summary presenter split。
- `dd4bf42d`: event row frame planning split。
- `eb607dbc`: event reference presenter planning。
- `d205ec55`: event tree list row planning。
- `90cd1d2e`: zap panel presenter split。
- `bbb10482`: event action presenter split。
- `6cfc1b58`: media/status presenter wiring proof。
- `46acf9fc`: event presenter docs alignment。
- `92fc94f0`: User Timeline read-command helper README index。
- `7555a1dc`: notification state type import cleanup。
- `9c7a4267`: cutover ledgers/task docs aligned with retained runtime guards.

次の agent は、これらを前提にしてよいです。ただし、各 commit の `Not-tested:` にある final gates は未実行です。

## Recommended next commands

最初の現状確認:

```sh
git log --oneline -8
git status --short
git diff --stat
```

今回 commit 後の確認:

```sh
git show --stat --oneline HEAD
git show --name-only --oneline HEAD
```

次 slice を選んだら:

```sh
git diff -- <candidate-files>
```

then run the narrowest focused tests first. Shared feed/runtime なら、必要に応じて:

```sh
cargo test -p lkjstr-ui <surface-or-helper>
cargo test -p lkjstr-app -- feed
pnpm test -- tests/unit/feed-surface
pnpm check:repo
```

Rust/WASM/browser proof が必要なら:

```sh
wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-d553f1d224c55714/chromedriver \
  <crate> --test <test-name>
```

## Stop condition for this handoff

この handoff の停止条件:

- Custom Request parser/query bounds の proof commit がある。
- 初版 handoff 後に残っていた coherent dirty slices が explicit staging で分割 commit 済み。
- retained Svelte event presenter split は unit/static tests で proof 済み。
- docs/current-state/cutover/task docs は retained runtime guard と full deletion proof の違いを明記済み。
- `git status --short` が clean。
- Lore protocol commit が揃っている。
- final gates 未実行を明記している。

ここまで終わったら、GPT-5.5-Pro は次の high-level 解決策検討に入れます。

# GPT-5.5-Pro Handoff: Shared Feed Runtime Stop Point

作成/更新日時: 2026-06-20
リポジトリ: `/home/lkjsxc/workspace/lkjstr`
ブランチ: `main`
依頼: 「切りの良いところで切り上げ、GPT-5.5-Pro に解決策を考えてもらうため、現状の問題点を含めて伝えたいことを `tmp/` に Markdown でまとめ、コミットも済ませる」

## 最重要結論

現在の第一未完了ブロッカーは、引き続き **Shared feed runtime** です。

このリポジトリは browser-first / local-first Nostr workspace です。shipped product runtime はまだ `src/` 配下の SvelteKit/TypeScript を多く含みます。目標は `crates/` 配下の Rust/WASM + Leptos runtime へ slice ごとに parity を証明しながら切り替えることです。サーバー側アカウント、relay proxy、custody service、backend はありません。

今回の停止点で安全に切った最後の slice は、**Custom Request の parser/query 入力境界を追加テストで証明する proof-only slice** です。実装の挙動変更は意図していません。すでに Rust 側で実装済みだった以下の制約を、focused tests で明示的に固定しました。

- invalid explicit relay は demand を発行しない。
- explicit relay 数上限を超えた入力は拒否する。
- JSON byte cap を parse 前に拒否する。
- search byte cap を拒否する。
- ids/authors/tag values の上限を拒否する。
- `search` filter は exact mode として分類する。
- Custom Request query は user filter の `since` / `until` / `search` / filter-local `limit` を保持し、runtime page size は query-level limit として別に保持する。

この handoff file 自体は最終 commit に含めるため、正確な最新 commit hash は `git log -1 --oneline` で確認してください。

## 絶対に守る制約

- `AGENTS.md` と `docs/agent/README.md` がこの repo の実行契約です。
- No fake product data。placeholder success state も不可です。
- TypeScript/Svelte product code を削除するには、Rust parity、focused tests、ledger evidence、no-import proof が必要です。
- Main-thread code は SQLite/OPFS を直接開かない。product modules は typed repositories だけを呼びます。
- `src` の source files は 200 lines 以下、docs は 300 lines 以下が通常ルールです。この `tmp/` handoff は、ユーザーが「どれだけ長くなっても構いません」と明示した例外として長く書いています。
- dirty worktree の既存変更はユーザーまたは過去作業由来として扱い、勝手に revert しないでください。
- 現在の worktree は複数 slice が混在しています。**`git add -A` / `git add .` は使わないでください。**
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

この handoff 直前までの verified commits:

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

今回この handoff と同じ commit に含める想定の最終 slice:

- `crates/lkjstr-app/tests/custom_request_plan_test.rs`
- `crates/lkjstr-app/tests/custom_request_test.rs`
- `crates/lkjstr-app/tests/feed_tool_input_test.rs`
- `tmp/gpt-5.5-pro-handoff-2026-06-20.md`

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

commit 前にさらに以下を走らせる予定です。commit message の `Tested:` は必ず最終実行結果に合わせてください。

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
- dirty worktree 全体の正当性。

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

### 2. dirty worktree が大きく、複数 slice が混ざっている

この handoff 作成時点で、worktree には今回 Custom Request proof slice 以外に broad edits が残っています。

大まかなグループ:

- Web Author Context browser test/readme の dirty slice。
- Svelte `src/lib/components/events/*` の presenter/component 分割。
- TS tests under `tests/unit/events/*` の大規模更新。
- cutover ledgers and task docs の広い wording update。
- `tests/unit/repo-deleted-paths.test.ts` の no-import/deletion guard 拡張。
- `src/lib/tabs/notifications/notification-list-state.ts` の unrelated-looking dirty edit。

これらは今回 commit しません。次の agent は最初に:

```sh
git status --short
git diff --stat
```

を見て、1 slice ずつ explicit staging してください。

### 3. docs dirty は一部だけが検証済み

`docs/current-state.md`, cutover ledgers, task docs に broad edits が残っています。

過去 commit では、必要最小 blob だけを index に入れて commit しています。そのため:

- `git status` で docs がまだ `M` でも expected です。
- `git add docs/current-state.md` のような broad add は未検証 wording を混ぜる可能性があります。
- docs は source と同じ commit で aligned にする必要がありますが、alignment の範囲は narrow にしてください。

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

### A. まず worktree を「何を commit できるか」で分類する

現状は実装アイデアがいくつも worktree に残っているように見えます。まず次の分類をしてください。

1. 既に coherent slice になっていて focused tests を足せば commit できるもの。
2. source と docs/tests の対応が足りず、追加実装が必要なもの。
3. 方向性は良いが broad すぎて分割が必要なもの。
4. ユーザー作業かもしれず触らない方がよいもの。

### B. 次の安全な slice 候補

候補は複数ありますが、次の順で考えるとよいです。

1. Web Author Context browser test/readme slice:
   - `crates/lkjstr-web/tests/author_context_tab_test.rs`
   - `crates/lkjstr-web/tests/README.md`
   - wasm browser proof が必要そうです。
2. Svelte event presenter split:
   - `src/lib/components/events/*`
   - `tests/unit/events/*`
   - 変更量が大きいので、1 presenter / 1 component / 1 behavior proof に分割してください。
3. docs/cutover ledger updates:
   - 実際に source と tests が揃った slice だけ stage してください。
4. deletion/no-import guard updates:
   - 実際に import が消えた path だけに限定して最後に commit してください。

### C. `src/lib/components/events/*` の大規模変更は特に注意

現在、多数の Svelte components と TS presenter/tests が dirty です。

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

今回の流れでは no-import guard や deletion-ledger wording が dirty に見えますが、TypeScript deletion は最後の証明です。

守るべき順序:

1. Rust parity 実装
2. Focused tests
3. Browser/wasm proof where needed
4. Docs/ledger evidence
5. No-import proof
6. Delete old TS/Svelte path
7. Final gates

この順序を飛ばして docs の「removed」や ledger の deletion status だけ進めないでください。

## Handoff 作成時点の dirty worktree summary

この Custom Request proof commit 後も、多くの dirty files が残る想定です。正確な現状は必ず `git status --short` で再確認してください。

主な modified files:

```text
crates/lkjstr-ui/src/workspace/README.md
crates/lkjstr-web/tests/README.md
crates/lkjstr-web/tests/author_context_tab_test.rs
docs/architecture/rust-wasm/cutover/deletion-ledger.md
docs/architecture/rust-wasm/cutover/implementation-ledger.md
docs/architecture/rust-wasm/cutover/parity-ledger.md
docs/architecture/workspace/ui-system/reaction-surfaces.md
docs/current-state.md
docs/execution/tasks/custom-request-provider-wiring.md
docs/execution/tasks/followees-provider-wiring.md
docs/execution/tasks/home-feed-provider-wiring.md
docs/execution/tasks/profile-feed-provider-wiring.md
docs/execution/tasks/search-feed-provider-wiring.md
docs/execution/tasks/thread-feed-provider-wiring.md
docs/product/tools/event-actions.md
src/lib/components/events/ContentTokens.svelte
src/lib/components/events/EmojifiedText.svelte
src/lib/components/events/EventActions.svelte
src/lib/components/events/EventContentCore.svelte
src/lib/components/events/EventFragmentRow.svelte
src/lib/components/events/EventMentionChip.svelte
src/lib/components/events/EventReferenceCard.svelte
src/lib/components/events/EventReferences.svelte
src/lib/components/events/EventRow.svelte
src/lib/components/events/EventTreeListRows.svelte
src/lib/components/events/EventZapPanel.svelte
src/lib/components/events/MediaAttachment.svelte
src/lib/components/events/ProfileMentionChip.svelte
src/lib/components/events/ReactionSummary.svelte
src/lib/components/events/event-actions-emoji-source.ts
src/lib/components/events/event-actions-plan.ts
src/lib/components/events/event-mention-chip-plan.ts
src/lib/components/events/event-meta-overflow.ts
src/lib/components/events/event-reference-card-plan.ts
src/lib/components/events/event-reference-hydration.ts
src/lib/components/events/event-row-local-target.ts
src/lib/components/events/event-tree-list-row-plan.ts
src/lib/components/events/event-zap-panel-plan.ts
src/lib/components/events/reaction-summary-plan.ts
src/lib/tabs/notifications/notification-list-state.ts
tests/unit/events/README.md
tests/unit/events/event-actions-plan.test.ts
tests/unit/events/event-actions-run-lifecycle.test.ts
tests/unit/events/event-mention-chip-plan.test.ts
tests/unit/events/event-meta-copy-status-lifecycle.test.ts
tests/unit/events/event-meta-overflow.test.ts
tests/unit/events/event-reference-card-plan.test.ts
tests/unit/events/event-reference-hydration.test.ts
tests/unit/events/event-row-local-target.test.ts
tests/unit/events/event-tree-list-row-plan.test.ts
tests/unit/events/event-zap-panel-plan.test.ts
tests/unit/events/event-zap-submit-lifecycle.test.ts
tests/unit/events/reaction-summary-plan.test.ts
tests/unit/repo-deleted-paths.test.ts
```

主な untracked files:

```text
src/lib/components/events/ContentTokenLink.svelte
src/lib/components/events/EventActionIconButton.svelte
src/lib/components/events/EventActionInlinePanel.svelte
src/lib/components/events/EventContentWarning.svelte
src/lib/components/events/EventRowFrame.svelte
src/lib/components/events/EventZapInvoiceRow.svelte
src/lib/components/events/ReactionSummaryActorRow.svelte
src/lib/components/events/emojified-text-plan.ts
src/lib/components/events/event-actions-control-plan.ts
src/lib/components/events/event-actions-label-plan.ts
src/lib/components/events/event-actions-panel-plan.ts
src/lib/components/events/event-actions-reaction-plan.ts
src/lib/components/events/event-actions-reply-plan.ts
src/lib/components/events/event-actions-run-plan.ts
src/lib/components/events/event-meta-copy-status.ts
src/lib/components/events/event-row-presentation-plan.ts
src/lib/components/events/event-zap-row-plan.ts
src/lib/components/events/event-zap-submit-plan.ts
src/lib/components/events/profile-mention-chip-plan.ts
src/lib/components/events/reaction-summary-label-plan.ts
tests/unit/events/emojified-text-plan.test.ts
tests/unit/events/event-actions-button-presenter.test.ts
tests/unit/events/event-actions-control-plan.test.ts
tests/unit/events/event-actions-inline-panel-presenter.test.ts
tests/unit/events/event-actions-label-plan.test.ts
tests/unit/events/event-actions-panel-plan.test.ts
tests/unit/events/event-actions-presenter.test.ts
tests/unit/events/event-actions-reaction-plan.test.ts
tests/unit/events/event-actions-reply-plan.test.ts
tests/unit/events/event-actions-run-plan.test.ts
tests/unit/events/event-content-presenter.test.ts
tests/unit/events/event-media-status-presenter.test.ts
tests/unit/events/event-mention-chip-presenter.test.ts
tests/unit/events/event-meta-copy-status.test.ts
tests/unit/events/event-reference-presenter.test.ts
tests/unit/events/event-row-presentation-plan.test.ts
tests/unit/events/event-tree-list-presenter.test.ts
tests/unit/events/event-zap-panel-presenter.test.ts
tests/unit/events/event-zap-row-plan.test.ts
tests/unit/events/event-zap-submit-plan.test.ts
tests/unit/events/profile-mention-chip-plan.test.ts
tests/unit/events/profile-mention-chip-presenter.test.ts
tests/unit/events/reaction-summary-label-plan.test.ts
tests/unit/events/reaction-summary-presenter.test.ts
```

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

- Custom Request parser/query bounds が focused tests で pass。
- 関連 tests/handoff だけ explicit staging。
- repo/doc/line/static checks を通す。
- Lore protocol commit を作る。
- broader dirty worktree は残すが、未検証として明記する。

ここまで終わったら、GPT-5.5-Pro は次の high-level 解決策検討に入れます。

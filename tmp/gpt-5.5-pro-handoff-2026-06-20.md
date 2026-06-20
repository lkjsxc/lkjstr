# GPT-5.5-Pro Handoff: Shared Feed Runtime Stop Point

作成/更新日時: 2026-06-20T07:35:00Z
リポジトリ: `/home/lkjsxc/workspace/lkjstr`
ブランチ: `main`
依頼: 「切りの良いところで切り上げ、GPT-5.5-Pro に解決策を考えてもらうため、現状の問題点を含めて伝えたいことを `tmp/` に Markdown でまとめ、コミットも済ませる」

## 最重要結論

現在の第一未完了ブロッカーは、引き続き **Shared feed runtime** です。

このリポジトリは browser-first / local-first Nostr workspace で、 shipped product runtime はまだ `src/` 配下の SvelteKit/TypeScript を多く含みます。目標は `crates/` 配下の Rust/WASM + Leptos runtime へ slice ごとに parity を証明しながら切り替えることです。サーバー側アカウント、relay proxy、custody service、backend はありません。

今回の停止点で安全に切った slice は、**Followees initial/retry read-command の active provider lease を controller helper に移し、replaced/provider-unavailable/unmount cleanup を focused test で証明する作業**です。

この handoff file 自体は最新 commit に含めるため、正確な最新 commit hash は `git log -1 --oneline` で確認してください。

## 絶対に守る制約

- `AGENTS.md` と `docs/agent/README.md` がこの repo の実行契約です。
- No fake product data。placeholder success state も不可です。
- TypeScript/Svelte product code を削除するには、Rust parity、focused tests、ledger evidence、no-import proof が必要です。
- Main-thread code は SQLite/OPFS を直接開かない。product modules は typed repositories だけを呼びます。
- `src` の source files は 200 lines 以下、docs は 300 lines 以下が通常ルールです。この `tmp/` handoff はユーザーが「どれだけ長くなっても構わない」と明示した例外です。
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

Followees/User Timeline の直近作業を見る時:

- `docs/execution/tasks/followees-provider-wiring.md`
- `docs/execution/tasks/user-timeline-provider-wiring.md`
- `crates/lkjstr-ui/src/workspace/followees.rs`
- `crates/lkjstr-ui/src/workspace/followees_read.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline_read.rs`
- `crates/lkjstr-ui/src/workspace/followees_provider.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline_provider.rs`

## 直近の検証済み commit

この handoff 直前の verified commits:

```text
43f2b428 Release replaced Custom Request run leases
556b2ddb Prove User Timeline incomplete diagnostics bucket
7eb1189d Explain User Timeline incomplete discovery
2de87a2d Guard retained feed helpers behind Rust island ownership
```

各 commit の意味:

- `7eb1189d`:
  - User Timeline incomplete discovery を route evidence から説明する `status_detail` を Rust app model に追加しました。
  - `incomplete-user-timeline-discovery` unavailable row reason を追加しました。
  - Leptos User Timeline read lease cleanup helper を追加しました。
  - `tmp/gpt-5.5-pro-handoff-2026-06-20.md` の旧版もここで更新されていました。
- `556b2ddb`:
  - `incomplete-user-timeline-discovery` Stats bucket mapping を wasm/browser test で証明しました。
  - `record_user_timeline_model_for_test` を debug/test hook として公開しました。
- `43f2b428`:
  - Custom Request run-command lease cleanup helper を追加しました。
  - replaced/provider-unavailable run が active lease を release することを focused tests で証明しました。
  - この commit では broader dirty docs/source は stage していません。

この handoff と同じ commit に含める想定の slice:

- Followees initial/retry read-command lease cleanup helper。
- Followees docs の最小証跡。
- この handoff file の全面更新。

## 今回の Followees slice

### 目的

Followees tab の initial read と retry read が active provider lease を `RwSignal<Option<FolloweesLease>>` で直接持つのをやめ、`FolloweesReadController` に集約します。

狙い:

- 次の read に差し替える前に前 lease を release する。
- provider が unavailable の read でも active lease を release する。
- component unmount cleanup でも active lease を release する。
- User Timeline / Custom Request と同じ helper pattern に寄せ、read/run command cleanup proof を揃える。

### 変更ファイル

今回 commit 対象にする source/docs:

- `crates/lkjstr-ui/src/workspace/followees.rs`
- `crates/lkjstr-ui/src/workspace/followees_read.rs`
- `crates/lkjstr-ui/src/workspace/README.md` の `followees_read.rs` 行だけ
- `docs/execution/tasks/followees-provider-wiring.md` の Followees read-command lease 証跡だけ
- `tmp/gpt-5.5-pro-handoff-2026-06-20.md`

注意:

- `crates/lkjstr-ui/src/workspace/README.md` には他の未検証 helper 行も dirty として残っています。今回 stage するのは `followees_read.rs` の 1 行だけです。
- `docs/execution/tasks/followees-provider-wiring.md` には Follow Graph no-import wording と Next Edit の未検証 edit も残っています。今回 stage するのは read-command lease の evidence/acceptance だけです。
- `crates/lkjstr-ui/src/workspace/mod.rs` は今回 stage しません。`followees_read.rs` は `followees.rs` 内の `#[path = "followees_read.rs"] mod followees_read;` で閉じています。

### 実装内容

`crates/lkjstr-ui/src/workspace/followees_read.rs` を追加しました。

役割:

- `Arc<Mutex<Option<FolloweesLease>>>` で active lease を保持。
- `read()` の先頭で現在の lease を release。
- provider が `None` の場合は false を返し、新しい read は dispatch しない。
- 新 lease の remember 中に lock が壊れている場合も新 lease を release。
- `release()` で active lease を明示 release。

`crates/lkjstr-ui/src/workspace/followees.rs` の変更:

- `FolloweesLease` を直接 import しなくなりました。
- `FolloweesReadController::new()` を作って initial read / retry read / cleanup を経由させます。
- initial read は provider の有無に関係なく controller に入ります。provider が無い場合も controller が active lease を空にするため、helper の unavailable path と component call surface が一致します。
- retry button は provider が無い場合は従来通り表示しません。

### Focused tests

追加/通過した Followees helper tests:

- `read_releases_previous_followees_lease`
- `unavailable_provider_releases_active_followees_lease`

実行済み:

```sh
PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  rustfmt --edition 2024 --check --config skip_children=true \
  crates/lkjstr-ui/src/workspace/followees.rs \
  crates/lkjstr-ui/src/workspace/followees_read.rs

PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH \
  cargo test -p lkjstr-ui followees
```

結果:

- rustfmt check: pass
- `cargo test -p lkjstr-ui followees`: pass
- lkjstr-ui unit side: 10 Followees-related tests passed
- `tests/followees_provider_test.rs`: 3 tests passed

この後、staging 後に repo/doc/line checks と `git diff --cached --check` を走らせる予定です。commit message の `Tested:` は必ず最終実行結果に合わせてください。

## 既に通した verification

この session で既に pass したもの:

### User Timeline incomplete discovery commit

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

### User Timeline Stats browser proof commit

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

### Custom Request run lease commit

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

Known caveat:

- `rustfmt --check` without `--config skip_children=true` on `crates/lkjstr-ui/src/workspace/mod.rs` recursed into unrelated dirty/committed modules and reported existing import-order noise in `user_timeline.rs`.
- pnpm emits Node engine warning: project wants Node `>=24.0.0`; environment is Node `v22.22.3`. Checks still passed under this warning.

## まだ主張してはいけないこと

Do not claim:

- Shared feed runtime 全体の完了。
- Followees runtime parity 全体の完了。
- User Timeline runtime parity 全体の完了。
- TypeScript/Svelte feed surface 全体の削除完了。
- `src/lib/follow-graph` deletion proof 完了。
- `src/lib/components` / shared event renderer parity 完了。
- Rust/WASM quiet gate の最新完走。
- Docker Compose final gate の pass。
- dirty worktree 全体の正当性。

## 現在の中心問題

### 1. Shared feed runtime はまだ巨大な途中状態

`docs/execution/current-blockers.md` の第一未完了 queue は Shared feed runtime です。

すでに証明済みの enabling proof は非常に多いですが、残りはまだ broad です。典型的には:

- shared feed rows / event rendering の parity。
- Rust Leptos surface と retained Svelte host glue の境界。
- older controls の real provider handler 化。
- Search / Custom Request / Followees / User Timeline / Author Context などの read/run cleanup proof の横展開。
- deletion ledger に進めるための no-import proof。
- final gates。

### 2. dirty worktree がかなり大きく、複数 slice が混ざっている

この handoff 作成時点で、worktree には今回 Followees slice 以外に broad edits が残っています。

大まかなグループ:

- Rust `crates/lkjstr-ui/src/workspace/feed_event_*` の event-row/action/content 分割。
- Rust `global_older.rs`, `notifications_older.rs`, `thread_older.rs`, `search_run.rs`, `search_older.rs` など older/query helper 系。
- Svelte `src/lib/components/events/*` の presenter/component 分割。
- TS tests under `tests/unit/events/*` の大規模更新。
- cutover ledgers and task docs の広い wording update。
- `crates/lkjstr-ui/Cargo.toml` の dependency update。
- `tests/unit/repo-deleted-paths.test.ts` の no-import/deletion guard 拡張。

これらは今回 commit しません。次の agent は最初に:

```sh
git status --short
git diff --stat
```

を見て、1 slice ずつ explicit staging してください。

### 3. docs dirty は一部だけが検証済み

`docs/current-state.md`, cutover ledgers, task docs に broad edits が残っています。

過去 3 commit では、必要最小 blob だけを index に入れて commit しています。そのため:

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

## 次に GPT-5.5-Pro に考えてほしいこと

### A. まず worktree を「何を commit できるか」で分類する

現状は実装アイデアがいくつも worktree に残っているように見えます。まず次の分類をしてください。

1. 既に coherent slice になっていて focused tests を足せば commit できるもの。
2. source と docs/tests の対応が足りず、追加実装が必要なもの。
3. 方向性は良いが broad すぎて分割が必要なもの。
4. ユーザー作業かもしれず触らない方がよいもの。

### B. 次の安全な slice 候補

候補は複数ありますが、個人的には次の順で考えるとよいです。

1. `global_older.rs`, `notifications_older.rs`, `thread_older.rs`, `search_older.rs`, `search_run.rs` の command helper cleanup を 1 helper / 1 surface ずつ検証して commit。
2. `feed_event_*` Rust helper 分割を、row activation / open policy / copy status / content plan のように小さく commit。
3. Svelte event component presenter split は大きいので、Rust shared renderer proof と関係する最小 presenter から test 付きで commit。
4. deletion/no-import guard updates は、実際に import が消えた path だけに限定して最後に commit。

ただし、dirty tree の内容は未検証です。GPT-5.5-Pro は必ず diff を読んでから判断してください。

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

今回 commit 後も、多くの dirty files が残る想定です。

主な modified files:

```text
crates/lkjstr-app/tests/custom_request_plan_test.rs
crates/lkjstr-app/tests/custom_request_test.rs
crates/lkjstr-app/tests/feed_tool_input_test.rs
crates/lkjstr-ui/Cargo.toml
crates/lkjstr-ui/src/workspace/README.md
crates/lkjstr-ui/src/workspace/feed_event_actions.rs
crates/lkjstr-ui/src/workspace/feed_event_actions_tests.rs
crates/lkjstr-ui/src/workspace/feed_event_content.rs
crates/lkjstr-ui/src/workspace/feed_event_content_tests.rs
crates/lkjstr-ui/src/workspace/feed_event_link.rs
crates/lkjstr-ui/src/workspace/feed_event_media.rs
crates/lkjstr-ui/src/workspace/feed_event_open.rs
crates/lkjstr-ui/src/workspace/feed_event_row.rs
crates/lkjstr-ui/src/workspace/feed_event_sensitive.rs
crates/lkjstr-ui/src/workspace/global_older.rs
crates/lkjstr-ui/src/workspace/mod.rs
crates/lkjstr-ui/src/workspace/notifications_older.rs
crates/lkjstr-ui/src/workspace/search.rs
crates/lkjstr-ui/src/workspace/thread_older.rs
crates/lkjstr-web/tests/README.md
crates/lkjstr-web/tests/author_context_tab_test.rs
docs/architecture/rust-wasm/cutover/deletion-ledger.md
docs/architecture/rust-wasm/cutover/feed-runtime.md
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
src/lib/components/events/*.svelte
src/lib/components/events/*-plan.ts
src/lib/tabs/notifications/notification-list-state.ts
tests/unit/events/*.test.ts
tests/unit/repo-deleted-paths.test.ts
```

主な untracked files:

```text
crates/lkjstr-ui/src/workspace/feed_event_action_policy.rs
crates/lkjstr-ui/src/workspace/feed_event_content_plan.rs
crates/lkjstr-ui/src/workspace/feed_event_content_plan_tests.rs
crates/lkjstr-ui/src/workspace/feed_event_copy_status.rs
crates/lkjstr-ui/src/workspace/feed_event_open_tests.rs
crates/lkjstr-ui/src/workspace/feed_event_row_activation.rs
crates/lkjstr-ui/src/workspace/search_older.rs
crates/lkjstr-ui/src/workspace/search_run.rs
src/lib/components/events/ContentTokenLink.svelte
src/lib/components/events/EventActionIconButton.svelte
src/lib/components/events/EventActionInlinePanel.svelte
src/lib/components/events/EventContentWarning.svelte
src/lib/components/events/EventRowFrame.svelte
src/lib/components/events/EventZapInvoiceRow.svelte
src/lib/components/events/ReactionSummaryActorRow.svelte
src/lib/components/events/*-plan.ts
tests/unit/events/*-presenter.test.ts
tests/unit/events/*-plan.test.ts
```

この一覧は分類用です。正確な現状は必ず `git status --short` で再確認してください。

## Recommended next commands

最初の現状確認:

```sh
git log --oneline -6
git status --short
git diff --stat
```

Followees commit 後の確認:

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

- Followees read-command cleanup が focused tests で pass。
- 関連 source/docs/handoff だけ explicit staging。
- repo/doc/line/static checks を通す。
- Lore protocol commit を作る。
- broader dirty worktree は残すが、未検証として明記する。

ここまで終わったら、GPT-5.5-Pro は次の high-level 解決策検討に入れます。

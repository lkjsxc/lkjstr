# GPT-5.5-Pro Handoff: Shared Feed Runtime Stop Point

作成/更新日時: 2026-06-20T06:45:00Z
リポジトリ: `/home/lkjsxc/workspace/lkjstr`
ブランチ: `main`
依頼: 「切りの良いところで切り上げ、GPT-5.5-Pro に解決策を考えてもらうため、現状の問題点を含めて伝えたいことを `tmp/` に Markdown でまとめ、コミットも済ませる」

## まず伝えたい結論

現在の第一未完了ブロッカーは、引き続き **Shared feed runtime** です。
SvelteKit/TypeScript の既存 runtime を壊さず、feed surface と複数 feed tab を Rust/WASM runtime へ段階移行している途中です。

今回の停止点で安全に切った slice は、**User Timeline の incomplete discovery を real route evidence から説明し、Leptos 側の表示と read lease cleanup を揃える作業**です。

この slice で主張してよいこと:

- Rust app model は `UserTimelineFeedStatus::Incomplete` に対し、attempted/failed/pending route source と target-only state から具体的な `status_detail` を生成する。
- incomplete 状態は `incomplete-user-timeline-discovery` の explicit unavailable row として view model に残る。
- Leptos `UserTimelineTab` は enum 固定文言ではなく、Rust app model の `status_detail` を表示する。
- Leptos `UserTimelineTab` は provider read lease を controller で所有し、次の read に差し替える時と provider unavailable になる時に前 lease を release する。
- Web diagnostics の Stats mapping は `incomplete-user-timeline-discovery` reason を bucket に含める。
- focused Rust tests、repo/doc/line checks、Prettier、`pnpm check:repo`、`git diff --cached --check` は pass している。

まだ主張してはいけないこと:

- Shared feed runtime 全体の完了。
- User Timeline runtime parity 全体の完了。
- TypeScript/Svelte feed surface 全体の削除完了。
- Rust/WASM quiet gate の最新完走。
- Docker Compose final gate の pass。
- dirty worktree 全体の正当性。
- `lkjstr-web` の `incomplete-user-timeline-discovery` Stats mapping が browser/wasm test で実証済み、という主張。実装は入っているが、この commit では wasm browser proof までは取っていない。

## 直前の commit

この作業の直前に、次の commit が既に存在します。

```text
2de87a2d Guard retained feed helpers behind Rust island ownership
```

その commit は、古い `src/lib/feed-surface/*` helper import を product import から外し、Rust island ownership と deletion/no-import guard へ寄せた stop slice です。

今回の commit は、その続きとして User Timeline に限定した Rust app/UI/web/docs slice を積みます。

## 絶対に守る制約

- `AGENTS.md` と `docs/agent/README.md` がこの repo の実行契約。
- No fake product data。placeholder success state も不可。
- TypeScript/Svelte product code を削除するには、Rust parity、focused tests、ledger evidence、no-import proof が必要。
- Main-thread code は SQLite/OPFS を直接触らない。typed repository 経由のみ。
- `src` の source files は 200 lines 以下、docs は 300 lines 以下。
- dirty worktree の既存変更はユーザーまたは以前の作業由来として扱い、勝手に revert しない。
- `git add -A` や `git add .` は危険。現在の worktree は複数 slice が混在しているため、次も explicit path staging が必要。
- commit message は Lore protocol。`Tested:` と `Not-tested:` は実際の検証と一致させる。

## まず読むべきファイル

GPT-5.5-Pro はまずこの順で読んでください。

1. `AGENTS.md`
2. `docs/current-state.md`
3. `docs/agent/README.md`
4. `docs/execution/current-blockers.md`
5. `docs/agent/skills/feed-runtime.md`
6. Shared feed runtime 周辺の read-first docs:
   - `docs/architecture/feeds/README.md`
   - `docs/architecture/feeds/runtime/README.md`
   - `docs/architecture/data/feed-surface/README.md`
   - `docs/architecture/data/cache-first-feed-pages.md`
   - `docs/architecture/data/feed-coverage.md`
   - `docs/execution/tasks/shared-feed-view-model.md`
   - `docs/execution/tasks/home-feed-slice.md`

今回の User Timeline slice を見る時は追加で次を読むとよいです。

- `docs/execution/tasks/user-timeline-provider-wiring.md`
- `crates/lkjstr-app/src/user_timeline/mod.rs`
- `crates/lkjstr-app/src/user_timeline/state.rs`
- `crates/lkjstr-app/src/user_timeline/view.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline.rs`
- `crates/lkjstr-web/src/user_timeline_host.rs`
- `crates/lkjstr-web/src/user_timeline_host_model.rs`
- `crates/lkjstr-web/src/user_timeline_host_view.rs`
- `crates/lkjstr-web/src/user_timeline_stats.rs`

## 今回 commit する slice

この handoff file は、下記の staged slice と同じ commit に含める前提です。
最終 commit hash は commit 後に `git log -1 --oneline` で確認してください。

### 目的

User Timeline discovery が incomplete になった時、単に「incomplete」と表示するのではなく、Rust route evidence から現在の欠落理由を説明する。
同時に、Leptos read provider の lease が差し替え時や provider unavailable 時に残らないようにする。

### Staged files

今回の staged boundary は次の 16 files です。

- `crates/lkjstr-app/src/user_timeline/defaults.rs`
- `crates/lkjstr-app/src/user_timeline/mod.rs`
- `crates/lkjstr-app/src/user_timeline/state.rs`
- `crates/lkjstr-app/src/user_timeline/status.rs`
- `crates/lkjstr-app/src/user_timeline/types.rs`
- `crates/lkjstr-app/src/user_timeline/view.rs`
- `crates/lkjstr-app/tests/README.md`
- `crates/lkjstr-app/tests/user_timeline_status_test.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline_read.rs`
- `crates/lkjstr-web/src/user_timeline_stats.rs`
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`
- `docs/architecture/rust-wasm/cutover/parity-ledger.md`
- `docs/current-state.md`
- `docs/execution/tasks/user-timeline-provider-wiring.md`
- `tmp/gpt-5.5-pro-handoff-2026-06-20.md`

重要:

- `docs/current-state.md`, `docs/architecture/rust-wasm/cutover/feed-runtime.md`, `docs/architecture/rust-wasm/cutover/parity-ledger.md` は、worktree に broad unrelated edits が残っていたため、index には今回 slice の最小 staged blob だけを入れている。
- 次の agent がこれらを再び `git add` すると、未検証の広い docs edits が混ざる可能性がある。
- commit 後にこれらの docs が `M` として残るのは expected dirty state。

### Rust app changes

`crates/lkjstr-app/src/user_timeline/status.rs` を追加しました。

役割:

- `INCOMPLETE_DISCOVERY_REASON = "incomplete-user-timeline-discovery"` を定義する。
- `user_timeline_status_detail(status, input)` で User Timeline status の表示文言を Rust app model 側に集約する。
- `UserTimelineFeedStatus::Incomplete` は attempted/failed/pending discovery route sources と `target_posts_only` state から説明文を作る。

例:

```text
Discovery incomplete: tried selected relays and target routes; selected relays failed; pending target routes; target-only posts unavailable from attempted routes. Selected relays may be insufficient; retry or add target routes.
```

設計上の注意:

- Missing follow-list coverage は「存在しない」と証明しない。
- そのため incomplete detail は retry/add route を促す retryable な説明にしている。
- `source_list` は route source labels を sort/dedup して、表示の不安定さを避けている。

`crates/lkjstr-app/src/user_timeline/view.rs` は次を行うようになりました。

- `status_detail` を生成する。
- status が `Incomplete` の時、`incomplete-user-timeline-discovery` の unavailable state row を追加する。
- `UserTimelineFeedView` に `status_detail` を含める。

`crates/lkjstr-app/src/user_timeline/types.rs` は `UserTimelineFeedView` に `status_detail: String` を追加しました。

`defaults.rs` と `state.rs` は rustfmt による import ordering の差分が入っています。

### Rust app tests

`crates/lkjstr-app/tests/user_timeline_status_test.rs` を追加しました。

検証していること:

- incomplete discovery でも real cached rows を残す。
- incomplete detail に attempted/failed/pending route evidence が入る。
- incomplete state row の reason が `incomplete-user-timeline-discovery` になる。
- target-only state を absence claim ではなく evidence-based detail として扱う。

### Leptos UI changes

`crates/lkjstr-ui/src/workspace/user_timeline.rs` は次のように変わりました。

- `UserTimelineReadController` を使って provider read lease を所有する。
- provider が `Some` の時だけ読んで終わりではなく、controller が active lease を管理する。
- provider が `None` になった時も active lease を release する。
- status text は enum match ではなく `model.status_detail` を返す。

`crates/lkjstr-ui/src/workspace/user_timeline_read.rs` を追加しました。

役割:

- active `UserTimelineLease` を `Arc<Mutex<Option<_>>>` で持つ。
- `read()` の先頭で既存 lease を release する。
- provider unavailable の時は false を返し、active lease は空にする。
- mutex poisoned 等で remember に失敗する場合も新 lease を release する。

UI unit tests:

- `read_releases_previous_user_timeline_lease`
- `unavailable_provider_releases_active_user_timeline_lease`

### Web diagnostics changes

`crates/lkjstr-web/src/user_timeline_stats.rs` に次を追加しました。

- `REASON_KEYS` に `incomplete-user-timeline-discovery` を追加。
- unavailable row reason mapping に `incomplete-user-timeline-discovery` を追加。

注意:

- この module は wasm target 側で使われる。
- native `cargo test -p lkjstr-web unavailable_key_maps_incomplete_user_timeline_discovery` は 0 tests になったため、native unit test はこの commit から削除した。
- Stats mapping の実装は入っているが、次に browser/wasm test で explicit proof を追加するのが望ましい。

### Docs/ledgers

最小限の docs update:

- `docs/current-state.md`
  - User Timeline が distinct query surfaces、real rows、exact cached coverage、target-only degraded rows、incomplete detail、partial status を Rust 側で持つことを反映。
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`
  - User Timeline が incomplete status detail を real route evidence から導出することを反映。
- `docs/architecture/rust-wasm/cutover/parity-ledger.md`
  - incomplete status detail proof と Stats mapping の記録を追加。
- `docs/execution/tasks/user-timeline-provider-wiring.md`
  - provider wiring task の最新証跡を更新。
- `crates/lkjstr-app/tests/README.md`
  - User Timeline status test を追加。

## 実行済み verification

環境:

- `PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH`
- pnpm は Node engine warning を出すことがある。
- Warning 内容: project wants Node `>=24.0.0`; current environment is Node `v22.22.3`。
- この warning の上で下記 gate は pass している。

### Focused Rust app tests

```sh
cargo test -p lkjstr-app user_timeline
```

結果:

- pass
- app unit tests: 7 user_timeline discovery tests passed
- integration tests:
  - `user_timeline_discovery_test.rs`: 2 passed
  - `user_timeline_feed_test.rs`: 4 passed
  - `user_timeline_status_test.rs`: 1 passed
  - `user_timeline_surface_input_test.rs`: 1 passed

### Focused Rust UI tests

```sh
cargo test -p lkjstr-ui user_timeline
```

結果:

- pass
- UI unit tests: 4 passed
- `tests/user_timeline_provider_test.rs`: 3 passed

### Rustfmt

対象:

- `crates/lkjstr-app/src/user_timeline/defaults.rs`
- `crates/lkjstr-app/src/user_timeline/mod.rs`
- `crates/lkjstr-app/src/user_timeline/state.rs`
- `crates/lkjstr-app/src/user_timeline/status.rs`
- `crates/lkjstr-app/src/user_timeline/types.rs`
- `crates/lkjstr-app/src/user_timeline/view.rs`
- `crates/lkjstr-app/tests/user_timeline_status_test.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline_read.rs`
- `crates/lkjstr-web/src/user_timeline_stats.rs`

結果:

- `rustfmt --check ...` pass

### Repo/doc/line/static checks

```sh
cargo run -p lkjstr-xtask -- check-docs
```

結果:

- `ok check-docs`

```sh
cargo run -p lkjstr-xtask -- check-lines
```

結果:

- `ok check-lines`

```sh
pnpm check:repo
```

結果:

- pass
- Node engine warning は出るが gate 自体は pass

```sh
git diff --cached --check
```

結果:

- pass

### Prettier

```sh
pnpm exec prettier --check \
  docs/current-state.md \
  docs/architecture/rust-wasm/cutover/feed-runtime.md \
  docs/architecture/rust-wasm/cutover/parity-ledger.md \
  docs/execution/tasks/user-timeline-provider-wiring.md \
  crates/lkjstr-app/tests/README.md
```

結果:

- pass

## 未実行/未主張

未実行:

- `pnpm rust-wasm:quiet`
- `pnpm verify:quiet`
- `pnpm cloudflare:quiet`
- Docker Compose final gate
- dirty worktree 全体を対象にした full validation
- Rust workspace 全体の `cargo test --workspace`
- User Timeline Stats mapping の browser/wasm test
- User Timeline runtime 全体の browser workflow parity

理由:

- ユーザー依頼は「切りの良いところで切り上げて、GPT-5.5-Pro 向けに現状をまとめ、commit する」。
- 今回の coherent stop slice は User Timeline status/read cleanup に限定できた。
- worktree には unrelated Rust/UI/event presenter/docs changes が大量に残っており、それらを含めた broad validation はこの stop slice の責務範囲を超える。
- Shared feed runtime 完了 claim には broad Rust/WASM quiet と Docker final gate が必要だが、今回は完了 claim をしていない。

## 現在の主な問題点

### 1. Shared feed runtime は未完了

`docs/execution/current-blockers.md` の第一未完了 blocker は Shared feed runtime。
今回の slice は User Timeline status/read cleanup を前進させただけです。

まだ残る大きな問題:

- feed surface 全体の Rust/WASM cutover completion。
- Svelte/TypeScript retained runtime の完全削除。
- Rust/WASM broad quiet の最新安定完走。
- Docker final gate。
- docs/current-state、implementation/parity/deletion/verification ledgers の全体整合。

### 2. User Timeline incomplete semantics は前進したが、browser proof が残っている

今回、Rust app model では incomplete reason と detail が明示されました。
Leptos UI も `status_detail` を表示します。

残る問題:

- Web diagnostics の `incomplete-user-timeline-discovery` bucket は実装されたが、browser/wasm test で直接 proof していない。
- User Timeline route provider/browser tests が incomplete 状態の Stats snapshot まで見ていない。
- `crates/lkjstr-web/tests/user_timeline_island_test.rs` は missing pubkey の diagnostics proof は持つが、incomplete reason proof ではない。
- 次に追加するなら、wasm browser test で incomplete model を実際に mount/record し、`user_timeline_diagnostics_snapshot()` の `reasons` に `incomplete-user-timeline-discovery` が出ることを確認するのがよい。

### 3. dirty worktree はまだ広く汚れている

今回の commit は staged scope だけを扱います。
worktree にはまだ未ステージ変更が大量に残っています。

残っている主な領域:

- Rust app tests:
  - `crates/lkjstr-app/tests/custom_request_plan_test.rs`
  - `crates/lkjstr-app/tests/custom_request_test.rs`
  - `crates/lkjstr-app/tests/feed_tool_input_test.rs`
- Rust UI workspace:
  - `crates/lkjstr-ui/Cargo.toml`
  - `crates/lkjstr-ui/src/workspace/README.md`
  - `crates/lkjstr-ui/src/workspace/custom_request.rs`
  - `crates/lkjstr-ui/src/workspace/feed_event_*`
  - `crates/lkjstr-ui/src/workspace/followees.rs`
  - `crates/lkjstr-ui/src/workspace/global_older.rs`
  - `crates/lkjstr-ui/src/workspace/mod.rs`
  - `crates/lkjstr-ui/src/workspace/notifications_older.rs`
  - `crates/lkjstr-ui/src/workspace/search.rs`
  - `crates/lkjstr-ui/src/workspace/thread_older.rs`
  - untracked `custom_request_run.rs`, `followees_read.rs`, `search_older.rs`, `search_run.rs`, and multiple feed event presenter helpers.
- Rust web tests/docs:
  - `crates/lkjstr-web/tests/README.md`
  - `crates/lkjstr-web/tests/author_context_tab_test.rs`
- Rust/WASM cutover docs:
  - `docs/architecture/rust-wasm/cutover/deletion-ledger.md`
  - `docs/architecture/rust-wasm/cutover/implementation-ledger.md`
  - worktree versions of `feed-runtime.md`, `parity-ledger.md`, and `docs/current-state.md`
- Task docs:
  - `docs/execution/tasks/custom-request-provider-wiring.md`
  - `docs/execution/tasks/followees-provider-wiring.md`
  - `docs/execution/tasks/home-feed-provider-wiring.md`
  - `docs/execution/tasks/profile-feed-provider-wiring.md`
  - `docs/execution/tasks/search-feed-provider-wiring.md`
  - `docs/execution/tasks/thread-feed-provider-wiring.md`
- Svelte event component / presenter extraction:
  - `src/lib/components/events/*`
  - `tests/unit/events/*`
  - many untracked presenter/plan/component files.

これらは今回の commit では検証していません。
次の agent は絶対に broad staging しないでください。

### 4. index/worktree 差分に注意

今回、複数 docs は staged index と worktree が意図的に違います。

背景:

- worktree には広い unrelated docs edits が含まれていた。
- staged commit には今回の User Timeline status/read cleanup 証跡だけを入れたかった。
- そのため index には最小 staged blob を入れている。

次の agent がやるべきこと:

- commit 後に `docs/current-state.md`, `docs/architecture/rust-wasm/cutover/feed-runtime.md`, `docs/architecture/rust-wasm/cutover/parity-ledger.md` が dirty として残っても慌てない。
- 残った worktree diff を読む。
- 次 slice に含めると決めるまでは再 staging しない。

### 5. docs line cap が厳しい

この repo は docs 300 lines 以下、source 200 lines 以下が重要。
今回の staged checks では `check-lines` pass。
ただし、以下の docs は既に上限付近になりがちです。

- `docs/current-state.md`
- `docs/execution/current-blockers.md`
- `docs/architecture/rust-wasm/cutover/*ledger.md`

次に docs を触る場合は、追記ではなく圧縮・置換を優先してください。

### 6. Node engine warning は既知

pnpm command で Node engine warning が出ることがあります。
今回の verification は warning の上で pass しています。

これは現状の主問題ではありませんが、CI や Docker final gate では Node version 差が別の失敗を起こす可能性はあります。

## 次に GPT-5.5-Pro に考えてほしいこと

### 問い 1: 残 dirty worktree をどう分割するべきか

現在の最大リスクは、実装方針そのものよりも commit/verification boundary の曖昧さです。

次に考えるべき分割候補:

1. User Timeline browser/wasm Stats proof slice
2. Rust workspace feed event action/content presenter slice
3. Svelte event component presenter extraction slice
4. Custom Request / Followees / Search read lease cleanup slice
5. docs/ledger reconciliation slice
6. remaining feed runtime parity/browser proof slice

各 slice は次を満たすべき:

- invariant が一文で言える。
- touched files が説明可能。
- focused tests がある。
- docs/ledger updates が同じ主張だけを記録している。
- unrelated dirty files を staging していない。

### 問い 2: User Timeline incomplete Stats proof をどこで取るべきか

候補:

- `crates/lkjstr-web/tests/user_timeline_island_test.rs` に incomplete diagnostics test を追加する。
- `crates/lkjstr-web/tests/user_timeline_route_provider_test.rs` か target-only/cleanup 系の既存 setup を使い、実際の provider path から incomplete を起こして snapshot を見る。
- `user_timeline_stats::record_model` を test-only export するかどうか検討する。

注意:

- test-only export は surface を広げるので、まず既存 browser path で証明できないか見るべき。
- native `cargo test -p lkjstr-web` では `user_timeline_stats.rs` が wasm target に gated され、直接 unit test proof にはならない。

### 問い 3: 次に「完了」と言える最小 blocker unit は何か

Shared feed runtime 全体は大きい。
次に完了主張できる最小 unit を決めてください。

候補:

- User Timeline status/read cleanup proof complete
- User Timeline browser Stats proof complete
- one tab island runtime proof complete
- event row presenter parity proof complete
- docs/ledger consistency correction

## 次に作業する agent のための具体手順

最初に実行:

```sh
git log --oneline -5
git status --short
git diff --name-status
git diff --cached --name-status
```

その後:

1. 最新 commit が今回の User Timeline status/read cleanup commit になっていることを確認。
2. 残 dirty worktree を領域別に読む。
3. まず read-only mapping をする。すぐ実装しない。
4. 次 slice の invariant と focused gate を決める。
5. explicit path list で staging。
6. `git diff --cached --check` と focused tests を通す。
7. docs/ledger の line cap を守る。

避ける command:

```sh
git add -A
git add .
git restore .
git reset --hard
```

## Staging boundary の補足

`tmp/` は `.gitignore` で ignored されていますが、この file は既に tracked です。
新規 tmp file を追加する場合は `git add -f` が必要です。
既存 tracked file の更新は通常 staging できますが、ignore の影響を避けるため明示的に扱ってください。

## 最終 stop condition

ここで追加実装は止めるべきです。

今回の stop condition:

- User Timeline status/read cleanup slice は focused verification 済み。
- handoff は `tmp/gpt-5.5-pro-handoff-2026-06-20.md` に更新済み。
- commit はこの file と staged slice を含めて作る。
- 残 dirty worktree は意図的に残す。
- Shared feed runtime 完了 claim はしない。

## 最後に

次の判断で一番重要なのは、「どのコードを変えるか」ではなく「どの invariant を今回の commit が証明するか」です。

現在のリスクは、複数の正しい方向の変更が同じ worktree に混在し、commit と verification の境界が曖昧になることです。
GPT-5.5-Pro には、残 dirty worktree を実装内容ではなく証明可能な slice に分解する方針を考えてほしいです。

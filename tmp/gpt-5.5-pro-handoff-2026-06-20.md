# GPT-5.5-Pro Handoff: Shared Feed Runtime Stop Point

作成/更新日時: 2026-06-20T06:00:00Z
リポジトリ: `/home/lkjsxc/workspace/lkjstr`
ブランチ: `main`
依頼: 「切りの良いところで切り上げ、GPT-5.5-Pro に解決策を考えてもらうため、現状の問題点を含めて伝えたいことを `tmp/` に Markdown でまとめ、コミットも済ませる」

## まず伝えたい結論

現在の第一未完了ブロッカーは、引き続き **Shared feed runtime** です。
SvelteKit/TypeScript の既存 runtime を壊さず、feed surface と複数 feed tab を Rust/WASM runtime へ段階移行しています。

今回の停止点で安全に切った slice は、**retained Svelte feed/tab helper を Rust island ownership 側へ寄せ、古い `src/lib/feed-surface/*` helper import を削除証明で固定する作業**です。

この slice で主張してよいこと:

- `feed-scroll-key`, `near-end-observer`, `notification-view-rows`, `scroll-intent`, `speculative-older` の古い `src/lib/feed-surface/` helper は、今回の staged/committed 範囲では product import から外れた。
- `scroll-intent` は `src/lib/components/feed/feed-scroll-intent.ts` に移動した。
- `notification-view-rows` は `src/lib/notifications/notification-view-rows.ts` に移動した。
- Timeline の older request helper は `src/lib/tabs/timeline/timeline-tab-older-requests.ts` に移った。
- Custom Request, Notifications, Profile, Search, Thread の retained Svelte tab wrappers は Rust island host へ委譲し、古い speculative older helper に依存しない形になった。
- deletion guard scripts/tests が入り、旧 helper path や旧 request helper の再 import を検出する。
- focused Vitest、canonical `pnpm test`、`pnpm check`、repo/doc/line guards、ESLint、Prettier、no-import proof は pass した。

まだ主張してはいけないこと:

- Shared feed runtime 全体の完了。
- TypeScript/Svelte feed surface 全体の削除完了。
- Rust/WASM broad quiet gate の最新完走。
- Docker Compose final gate の pass。
- dirty worktree 全体の正当性。

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

## 今回の停止点で commit する slice

この handoff file は、下記の staged slice と同じ commit に含める前提です。
commit hash は commit 後に `git log -1 --oneline` で確認してください。

### 目的

古い `src/lib/feed-surface/` retained helper を product import から外し、Rust island ownership と移動先 helper に責務を寄せる。
さらに、削除済み helper の復活や再 import を repo guard で検知できるようにする。

### 主な source changes

- `src/lib/components/feed/FeedScrollSurface.svelte`
  - 旧 `feed-scroll-key` import をやめ、missing row key handling を local inline helper にした。
  - `scroll-intent` import を `./feed-scroll-intent` に変更。
- `src/lib/components/feed/feed-scroll-intent.ts`
  - `src/lib/feed-surface/scroll-intent.ts` から移動。
- `src/lib/components/events/EventTreeListNearEnd.svelte`
  - 旧 `near-end-observer` helper import をやめ、near-end sentinel planning を component 側に inline 化。
- `src/lib/notifications/notification-view-rows.ts`
  - `src/lib/feed-surface/notification-view-rows.ts` から移動。
- `src/lib/tabs/notifications/NotificationListScroll.svelte`
  - notification row helper の import 先を `$lib/notifications/notification-view-rows` に変更。
- `src/lib/tabs/timeline/timeline-tab-older-requests.ts`
  - Timeline 専用 older request coordinator を追加。
- `src/lib/tabs/timeline/TimelineTab.svelte`
  - 旧 shared speculative older helper import をやめ、Timeline 専用 coordinator を使う。
- `src/lib/tabs/custom-request/CustomRequestTab.svelte`
- `src/lib/tabs/notifications/NotificationsTab.svelte`
- `src/lib/tabs/profile/ProfileTab.svelte`
- `src/lib/tabs/search/SearchTab.svelte`
- `src/lib/tabs/thread/ThreadTab.svelte`
  - retained wrapper は Rust island host に委譲する薄い wrapper になり、旧 speculative older helper を import しない。

### Deleted/moved old helpers

削除:

- `src/lib/feed-surface/feed-scroll-key.ts`
- `src/lib/feed-surface/near-end-observer.ts`
- `src/lib/feed-surface/speculative-older.ts`
- `tests/unit/feed-surface/feed-scroll-key.test.ts`

移動:

- `src/lib/feed-surface/scroll-intent.ts` -> `src/lib/components/feed/feed-scroll-intent.ts`
- `tests/unit/feed-surface/scroll-intent.test.ts` -> `tests/unit/feed/feed-scroll-intent.test.ts`
- `src/lib/feed-surface/notification-view-rows.ts` -> `src/lib/notifications/notification-view-rows.ts`
- `tests/unit/feed-surface/speculative-older.test.ts` -> `tests/unit/timeline/timeline-tab-older-requests.test.ts`

### Repo guards

追加/更新:

- `scripts/check-repo.ts`
- `scripts/repo-custom-request-deletions.ts`
- `scripts/repo-feed-surface-deletions.ts`
- `scripts/repo-follow-graph-deletions.ts`
- `scripts/repo-notifications-deletions.ts`
- `scripts/repo-profile-deletions.ts`
- `scripts/repo-search-deletions.ts`
- `scripts/repo-thread-deletions.ts`
- `scripts/repo-user-timeline-deletions.ts`

対応 tests:

- `tests/unit/repo-custom-request-deletions.test.ts`
- `tests/unit/repo-feed-surface-deletions.test.ts`
- `tests/unit/repo-follow-graph-deletions.test.ts`
- `tests/unit/repo-notifications-deletions.test.ts`
- `tests/unit/repo-profile-deletions.test.ts`
- `tests/unit/repo-search-deletions.test.ts`
- `tests/unit/repo-thread-deletions.test.ts`
- `tests/unit/repo-user-timeline-deletions.test.ts`
- 既存 `tests/unit/repo-feed-tab-islands.test.ts` も focused proof に含めた。

### Docs/ledgers

更新:

- `docs/architecture/data/feed-surface/feed-scroll-surface.md`
- `docs/architecture/data/feed-surface/near-end.md`
- `docs/architecture/data/feed-surface/surface-matrix.md`
- `docs/architecture/rust-wasm/cutover/deletion-ledger.md`
- `docs/product/doc-impl-audit.md`
- `src/lib/components/feed/README.md`
- `src/lib/feed-surface/README.md`
- `src/lib/notifications/README.md`
- `src/lib/tabs/timeline/README.md`
- `tests/unit/README.md`
- `tests/unit/feed/README.md`
- `tests/unit/feed-surface/README.md`
- `tests/unit/notifications/README.md`
- `tests/unit/timeline/README.md`

重要:

- `docs/architecture/rust-wasm/cutover/deletion-ledger.md` は worktree 側に broad unrelated edits が残っていたため、index には最小限の staged version だけを入れている。
- 次の agent が `git add docs/architecture/rust-wasm/cutover/deletion-ledger.md` を再実行すると、未検証の広い docs edits が混ざる可能性がある。
- commit 後に同ファイルが `M` として残っても、それはこの理由による expected dirty state。

## 実行済み verification

環境:

- `PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH`
- pnpm は Node engine warning を出すことがある。
- Warning 内容: project wants Node `>=24.0.0`; current environment is Node `v22.22.3`。
- この warning の上で下記 gate は pass している。

### Type/Svelte check

```sh
pnpm check
```

結果:

- pass
- `svelte-check found 0 errors and 0 warnings`

### Focused Vitest

```sh
pnpm exec vitest run \
  tests/unit/repo-custom-request-deletions.test.ts \
  tests/unit/repo-feed-surface-deletions.test.ts \
  tests/unit/repo-feed-tab-islands.test.ts \
  tests/unit/repo-follow-graph-deletions.test.ts \
  tests/unit/repo-notifications-deletions.test.ts \
  tests/unit/repo-profile-deletions.test.ts \
  tests/unit/repo-search-deletions.test.ts \
  tests/unit/repo-thread-deletions.test.ts \
  tests/unit/repo-user-timeline-deletions.test.ts \
  tests/unit/feed/feed-scroll-intent.test.ts \
  tests/unit/timeline/timeline-tab-older-requests.test.ts \
  tests/unit/notifications/notification-view-rows.test.ts \
  tests/unit/cache/pins.test.ts
```

結果:

- pass
- 13 files passed
- 40 tests passed

### Canonical pnpm test script for this slice

```sh
pnpm test -- \
  tests/unit/feed \
  tests/unit/feed-surface \
  tests/unit/timeline/timeline-tab-older-requests.test.ts \
  tests/unit/notifications/notification-view-rows.test.ts \
  tests/unit/cache/pins.test.ts \
  tests/unit/repo-custom-request-deletions.test.ts \
  tests/unit/repo-feed-surface-deletions.test.ts \
  tests/unit/repo-feed-tab-islands.test.ts \
  tests/unit/repo-follow-graph-deletions.test.ts \
  tests/unit/repo-notifications-deletions.test.ts \
  tests/unit/repo-profile-deletions.test.ts \
  tests/unit/repo-search-deletions.test.ts \
  tests/unit/repo-thread-deletions.test.ts \
  tests/unit/repo-user-timeline-deletions.test.ts
```

結果:

- pass
- Vitest script behavior により broad suite になった。
- 340 files passed
- 1132 tests passed

### Repo/doc/line/static checks

```sh
pnpm check:repo
```

結果:

- pass

```sh
cargo run -p lkjstr-xtask -- check-docs
```

結果:

- pass

```sh
cargo run -p lkjstr-xtask -- check-lines
```

結果:

- pass

```sh
git diff --cached --check
```

結果:

- pass

### ESLint / Prettier

ESLint は staged TypeScript/Svelte/test files を対象に実行し pass。

Prettier は selected staged paths に対して実行し pass。

追加で、synthetic staged version の deletion ledger を temp file に取り出して Prettier check し pass。

### No-import proof

```sh
rg -n \
  -e "feed-surface/(feed-scroll-key|near-end-observer|notification-view-rows|scroll-intent|speculative-older)" \
  -e "\\.\\./feed-surface/(feed-scroll-key|near-end-observer|notification-view-rows|scroll-intent|speculative-older)" \
  -e "createOlderRequestCoordinator\\b" \
  src tests scripts \
  --glob '!tests/unit/repo-feed-surface-deletions.test.ts' \
  --glob '!scripts/repo-feed-surface-deletions.ts'
```

結果:

- no matches
- exit code 1 を expected success として `test $? -eq 1` で確認。

## 未実行/未主張

未実行:

- `pnpm rust-wasm:quiet`
- Docker Compose final gate
- dirty worktree 全体を対象にした full validation
- Rust crates の broad `cargo test --workspace`
- Rust/WASM browser tests for every tab touched historically by the dirty worktree

理由:

- 今回の commit は TypeScript/Svelte host glue、helper deletion、repo guard の小さな停止 slice。
- worktree には unrelated Rust/UI/event presenter changes が大量に残っており、それらを含めた broad validation はこの stop slice の責務範囲を超える。
- Shared feed runtime 完了 claim には broad Rust/WASM quiet と Docker final gate が必要だが、今回は完了 claim をしていない。

## 現在の主な問題点

### 1. Shared feed runtime は未完了

`docs/execution/current-blockers.md` の第一未完了 blocker は Shared feed runtime。
今回の slice は、その中の deletion/no-import proof を前進させただけです。

まだ残る大きな問題:

- feed surface 全体の Rust/WASM cutover completion。
- Svelte/TypeScript retained runtime の完全削除。
- Rust/WASM broad quiet の最新安定完走。
- Docker final gate。
- docs/current-state、implementation/parity/deletion/verification ledgers の全体整合。

### 2. dirty worktree はまだ広く汚れている

今回の commit は staged scope だけを扱います。
worktree にはまだ未ステージ変更が大量に残っています。

残っている主な領域:

- Rust app/UI/web changes:
  - `crates/lkjstr-app/src/user_timeline/*`
  - `crates/lkjstr-ui/src/workspace/*`
  - `crates/lkjstr-web/src/user_timeline_stats.rs`
  - related Rust tests
- Svelte event component / presenter extraction:
  - `src/lib/components/events/*`
  - `tests/unit/events/*`
  - many untracked presenter/plan/component files
- docs and task files:
  - `docs/current-state.md`
  - `docs/execution/tasks/*provider-wiring.md`
  - `docs/architecture/rust-wasm/cutover/*ledger.md`
  - `docs/product/tools/event-actions.md`

これらは今回の commit では検証していません。
次の agent は絶対に broad staging しないでください。

### 3. deletion ledger の index/worktree 差分に注意

今回、`docs/architecture/rust-wasm/cutover/deletion-ledger.md` は staged index と worktree が意図的に違います。

背景:

- worktree には広い unrelated docs edits が含まれていた。
- staged commit には今回の feed-surface helper deletion 証跡だけを入れたい。
- そのため index には `git update-index --cacheinfo` で最小 staged blob を入れている。

次の agent がやるべきこと:

- commit 後に同ファイルが dirty として残っても慌てない。
- 残った worktree diff を読む。
- 次 slice に含めると決めるまでは再 staging しない。

### 4. `speculative-older.ts` は今回削除したが、意味は重い

今回の staged slice では `src/lib/feed-surface/speculative-older.ts` を削除した。
これは単独削除ではなく、複数 tab wrapper を Rust island host に委譲する変更とセットで成立している。

重要な理解:

- `HEAD` では Notifications/Profile/Search/Thread/Timeline が old speculative older helper を import していた。
- 今回の staged slice では Timeline は専用 older request coordinator へ移行。
- Notifications/Profile/Search/Thread は retained wrapper が Rust island host に委譲し、old helper を使わない。
- repo guard と no-import proof がその境界を固定する。

未解決:

- Rust island 側の behavior 全体を broad browser/wasm gate で証明したわけではない。
- したがって「tab runtime 全体が完全に Rust parity」とは言わない。
- ただし今回の helper deletion/no-import slice としては focused verification がある。

### 5. docs line cap が厳しい

この repo は docs 300 lines 以下、source 200 lines 以下が重要。
今回の staged checks では `check-lines` pass。
ただし、以下の docs は既に上限付近になりがち:

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

1. Rust user timeline/read/status slice
2. Rust workspace/feed event action/content presenter slice
3. Svelte event component presenter extraction slice
4. docs/ledger reconciliation slice
5. remaining feed runtime parity/browser proof slice

各 slice は次を満たすべき:

- invariant が一文で言える。
- touched files が説明可能。
- focused tests がある。
- docs/ledger updates が同じ主張だけを記録している。
- unrelated dirty files を staging していない。

### 問い 2: Rust island wrapper への委譲をどの gate で十分とみなすか

今回の helper deletion は focused TS/Svelte tests と no-import proof で止めた。
しかし、Rust island wrapper に委譲した tab behavior を runtime parity とみなすなら、browser/wasm proof が必要です。

GPT-5.5-Pro に見てほしい観点:

- `CustomRequestTab.svelte`, `NotificationsTab.svelte`, `ProfileTab.svelte`, `SearchTab.svelte`, `ThreadTab.svelte` の props/lifecycle は既存 runtime と同等か。
- mount/unmount cleanup は retained runtime の close/destroy semantics を満たすか。
- older request/footer/unavailable states は Rust island 側で本当に表現されているか。
- no-op success or placeholder state が紛れていないか。
- browser tests の最小セットはどれか。

### 問い 3: 次に「完了」と言える最小 blocker unit は何か

Shared feed runtime 全体は大きい。
次に完了主張できる最小 unit を決めてください。

候補:

- retained helper deletion proof complete
- one tab island runtime proof complete
- user timeline read/status proof complete
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

1. 最新 commit が今回の helper deletion/handoff commit になっていることを確認。
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

今回 staged されていた範囲は 51 files で、handoff file を加えると 52 files になります。

`tmp/` は `.gitignore` で ignored されていますが、この file は既に tracked です。
新規 tmp file を追加する場合は `git add -f` が必要です。
既存 tracked file の更新は通常 staging できますが、ignore の影響を避けるため明示的に扱ってください。

## 最終 stop condition

ここで追加実装は止めるべきです。

今回の stop condition:

- helper deletion/Rust island wrapper slice は focused verification 済み。
- handoff は `tmp/gpt-5.5-pro-handoff-2026-06-20.md` に更新済み。
- commit はこの file と staged slice を含めて作る。
- 残 dirty worktree は意図的に残す。
- Shared feed runtime 完了 claim はしない。

## 最後に

次の判断で一番重要なのは、「どのコードを変えるか」ではなく「どの invariant を今回の commit が証明するか」です。

現在のリスクは、複数の正しい方向の変更が同じ worktree に混在し、commit と verification の境界が曖昧になることです。
GPT-5.5-Pro には、残 dirty worktree を実装内容ではなく証明可能な slice に分解する方針を考えてほしいです。

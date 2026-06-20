# GPT-5.5-Pro Handoff: Shared Feed Runtime Stopping Point

作成/更新日時: 2026-06-20T05:15:38Z
リポジトリ: `/home/lkjsxc/workspace/lkjstr`
ブランチ: `main`
停止理由: ユーザー指示により、切りの良いところで作業を止め、GPT-5.5-Pro に渡すための現状整理を作成する。

## まず伝えたい結論

このリポジトリの現在の第一未完了ブロッカーは、引き続き **Shared feed runtime** です。
SvelteKit/TypeScript の既存プロダクトを壊さずに、feed surface と各 feed tab を Rust/WASM runtime へ段階移行しています。

この停止点では、Shared feed runtime 全体の完了は主張できません。直近で安全に完了したのは、残存 Svelte event row chrome を Rust cutover 中の parity proof として小さく固定する slice です。その後、feed-surface helper deletion の次 slice に入りかけましたが、`speculative-older.ts` の削除が複数タブの Rust island 化と絡むことが分かったため、未検証の大きな差分を混ぜずに停止しました。

次に GPT-5.5-Pro に考えてほしい主問題は次の 2 点です。

1. 現在の dirty worktree を、どの単位で安全に分割して commit/verify するか。
2. `src/lib/feed-surface/speculative-older.ts` などの helper 削除を、単独の削除証明 slice として進めるのか、複数 feed tab の Rust island 化 slice として扱うのか。

## 絶対に守る制約

- `AGENTS.md` のプロジェクト制約が最上位の実行ルール。
- No fake product data。placeholder success state も不可。
- TypeScript/Svelte product code を削除するには、Rust parity、focused tests、ledger evidence、no-import proof が必要。
- Main-thread code は SQLite/OPFS を直接触らない。typed repository 経由のみ。
- `src` の source files は 200 lines 以下、docs は 300 lines 以下。
- dirty worktree の既存変更はユーザーまたは以前の作業由来として扱い、勝手に revert しない。
- 広い `git add -A` は危険。commit は説明可能な責任範囲に分ける。

## まず読むべきファイル

GPT-5.5-Pro は、まずこの順で読んでください。

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

## 直近コミット

### `707621a9 Correct Rust WASM verification evidence`

目的:
Rust/WASM 検証 ledger の記述を、実際の検証結果に合わせて修正しました。

変更:

- `docs/architecture/rust-wasm/cutover/verification-ledger.md`

重要な点:

- targeted wasm-pack tests は pass。
- broad `pnpm rust-wasm:quiet` は外部 900s 制限を超過し、完走は確認していません。
- したがって、broad Rust/WASM quiet 全体の pass を主張しないよう ledger を修正しています。

確認済み targeted tests:

```sh
wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-d553f1d224c55714/chromedriver \
  crates/lkjstr-web --test followees_relay_provider_test
```

結果:

- 3 tests passed

```sh
wasm-pack test --headless --chrome \
  --chromedriver /home/lkjsxc/.cache/.wasm-pack/chromedriver-d553f1d224c55714/chromedriver \
  crates/lkjstr-web --test profile_feed_tab_test
```

結果:

- 6 tests passed

補助 verification:

- Prettier passed for touched docs.
- `cargo run -p lkjstr-xtask -- check-docs` passed.
- `cargo run -p lkjstr-xtask -- check-lines` passed.
- `git diff --check` passed.

### `ea60ce73 Preserve retained row avatar chrome during cutover`

目的:
Rust/WASM cutover 中も、残存 Svelte row avatar の fallback/interactive chrome を壊さないよう固定しました。

変更:

- `src/lib/components/events/EventRowAvatar.svelte`
- `tests/unit/events/event-row-presenter.test.ts`
- `src/lib/components/events/README.md`
- `docs/execution/current-blockers.md`
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`

内容:

- Event row avatar の display branch を専用 component に分離。
- presenter test で avatar chrome の構造を固定。
- docs/ledger に retained Svelte parity proof として記録。

### `ab6a5447 Preserve retained metadata identity chrome during cutover`

目的:
Rust/WASM cutover 中も、`EventMeta.svelte` の author identity chrome を openable/static branch 間で壊さないよう固定しました。

変更:

- `src/lib/components/events/EventMeta.svelte`
- `tests/unit/events/event-meta-presenter.test.ts`
- `src/lib/components/events/README.md`
- `docs/execution/current-blockers.md`
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`
- `tmp/gpt-5.5-pro-handoff-2026-06-20.md`

内容:

- openable な `button` branch と static な `span` branch が、同じ author identity body を別々に描いていた。
- `identityBody` snippet に inline avatar、`EmojifiedText`、subtitle を集約。
- openable branch は `button`、static branch は `span` のまま。
- profile open 条件、click behavior、pubkey fallback は変更していません。

検証:

```sh
pnpm exec vitest run \
  tests/unit/events/event-meta-presenter.test.ts \
  tests/unit/events/event-profile-activation.test.ts \
  tests/unit/events/event-meta-overflow.test.ts \
  tests/unit/events/event-meta-copy-status.test.ts \
  tests/unit/events/event-meta-copy-status-lifecycle.test.ts
```

結果:

- 編集前: 5 files passed, 19 tests passed
- 編集後: 5 files passed, 20 tests passed

追加で確認:

- `pnpm exec eslint src/lib/components/events/EventMeta.svelte tests/unit/events/event-meta-presenter.test.ts`
- targeted Prettier check
- `pnpm check`
- broader `pnpm test -- ...` が実質 340 files / 1132 tests を pass
- `pnpm check:repo`
- `cargo run -p lkjstr-xtask -- check-docs`
- `cargo run -p lkjstr-xtask -- check-lines`
- `git diff --check`
- `pnpm verify:quiet`

### `8a7a5a62 Move feed parity closer to Rust island ownership`

これは大きな先行 commit です。Shared feed runtime / Rust island ownership に関わる多数の Rust, TS, docs, tests を含んでいます。

大まかな内容:

- Custom Request, Home, Global, Notifications, Profile, Search, Thread などの Rust island 関連 glue。
- feed view model / geometry / scan / row rendering parity の拡張。
- `src/lib/components/workspace/*-island.ts` 系の Svelte host glue。
- feed scroll/geometry/row chrome regression tests。
- cutover ledger/docs updates。

この commit 自体はすでに入っていますが、現在の dirty worktree にはその後の追加差分が大量に残っています。

## 現在の作業ツリー状態

確認時点:

```sh
git status --short | wc -l
```

結果:

- 191 entries

内訳の目安:

- modified tracked files: 117
- deleted tracked files: 8
- untracked files: 75
- `git diff --stat`: 117 tracked files changed, 2065 insertions, 2741 deletions

重要:

- この dirty worktree は、今回の停止点で丸ごと commit するには広すぎます。
- 未検証の helper deletion、tab island rewrite、event presenter extraction、Rust module additions が混在しています。
- `git add -A` や broad path staging は避けてください。
- 次に進めるなら、まず責任範囲を決めて、explicit path list で staging してください。

## 現在 dirty な主な領域

### Rust app/UI/web 側

例:

- `crates/lkjstr-app/src/user_timeline/*`
- `crates/lkjstr-ui/src/workspace/*`
- `crates/lkjstr-web/src/user_timeline_stats.rs`
- `crates/lkjstr-app/tests/*`
- `crates/lkjstr-web/tests/*`

未追跡ファイルもあります。

例:

- `crates/lkjstr-app/src/user_timeline/status.rs`
- `crates/lkjstr-ui/src/workspace/custom_request_run.rs`
- `crates/lkjstr-ui/src/workspace/feed_event_action_policy.rs`
- `crates/lkjstr-ui/src/workspace/search_older.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline_read.rs`

これらは Rust/WASM runtime parity か deletion proof の一部に見えますが、今回の停止点では詳細検証していません。

### Svelte event components / presenter extraction

例:

- `src/lib/components/events/ContentTokens.svelte`
- `EventActions.svelte`
- `EventContentCore.svelte`
- `EventFragmentRow.svelte`
- `EventMentionChip.svelte`
- `EventReferenceCard.svelte`
- `EventReferences.svelte`
- `EventRow.svelte`
- `EventTreeListNearEnd.svelte`
- `EventTreeListRows.svelte`
- `EventZapPanel.svelte`
- `MediaAttachment.svelte`
- `ProfileMentionChip.svelte`
- `ReactionSummary.svelte`

未追跡 presenter/plan/component も多数あります。

例:

- `ContentTokenLink.svelte`
- `EventActionIconButton.svelte`
- `EventActionInlinePanel.svelte`
- `EventContentWarning.svelte`
- `EventRowFrame.svelte`
- `EventZapInvoiceRow.svelte`
- `ReactionSummaryActorRow.svelte`
- `event-actions-control-plan.ts`
- `event-actions-run-plan.ts`
- `event-row-presentation-plan.ts`
- `reaction-summary-label-plan.ts`

この領域は、retained Svelte parity proof を細かく積む作業として扱うべきです。Shared feed runtime の本丸と混ぜるとレビュー不能になります。

### Feed-surface helper deletion candidate

作業途中で次の tracked files が削除状態です。

- `src/lib/feed-surface/feed-scroll-key.ts`
- `src/lib/feed-surface/near-end-observer.ts`
- `src/lib/feed-surface/notification-view-rows.ts`
- `src/lib/feed-surface/scroll-intent.ts`
- `src/lib/feed-surface/speculative-older.ts`
- `tests/unit/feed-surface/feed-scroll-key.test.ts`
- `tests/unit/feed-surface/scroll-intent.test.ts`
- `tests/unit/feed-surface/speculative-older.test.ts`

新しい/移動後の候補:

- `src/lib/components/feed/feed-scroll-intent.ts`
- `tests/unit/feed/feed-scroll-intent.test.ts`
- `tests/unit/feed/README.md`
- `src/lib/notifications/notification-view-rows.ts`
- `src/lib/tabs/timeline/timeline-tab-older-requests.ts`
- `tests/unit/timeline/timeline-tab-older-requests.test.ts`

current worktree では product source の deleted helper imports はほぼ除去されています。`rg` で残る主な match は deletion guard tests/docs です。

ただし、これは **current worktree** の話です。`HEAD` ではまだ次の imports が存在します。

- `EventTreeListNearEnd.svelte` imports `feed-surface/near-end-observer`
- `FeedScrollSurface.svelte` imports `feed-surface/feed-scroll-key`
- `FeedScrollSurface.svelte` imports `feed-surface/scroll-intent`
- `NotificationListScroll.svelte` imports `feed-surface/notification-view-rows`
- `NotificationsTab.svelte` imports `feed-surface/speculative-older`
- `ProfileTab.svelte` imports `feed-surface/speculative-older`
- `SearchTab.svelte` imports `feed-surface/speculative-older`
- `ThreadTab.svelte` imports `feed-surface/speculative-older`
- `TimelineTab.svelte` imports `feed-surface/speculative-older`
- related old tests import the old helper files.

このため、`speculative-older.ts` の削除だけを小さく commit するのは危険です。少なくとも複数 tab body の rewrite と deletion guard が絡みます。

### Tab island rewrite candidate

current worktree では、複数の Svelte tab が Rust island host に寄っています。

確認済みの import/mount 例:

- `src/lib/tabs/custom-request/CustomRequestTab.svelte` uses `mountCustomRequestIsland`
- `src/lib/tabs/notifications/NotificationsTab.svelte` uses `mountNotificationsIsland`
- `src/lib/tabs/profile/ProfileTab.svelte` uses `mountProfileIsland`
- `src/lib/tabs/search/SearchTab.svelte` uses `mountSearchIsland`
- `src/lib/tabs/thread/ThreadTab.svelte` uses `mountThreadIsland`
- `src/lib/components/workspace/PaneFeedTabBody.svelte` imports multiple island wrappers and `RustIslandHost`

この rewrite は `speculative-older.ts` import 除去と密接に関係しています。

ただし、これを commit するには、以下を先に揃えるべきです。

- 各 tab の Rust island wrapper が tracked/staged されていること。
-各 tab の mount props と lifetime cleanup が既存 runtime contract と一致していること。
- old Svelte tab body の deletion proof/no-import proof があること。
- focused browser/wasm tests が通っていること。
- docs/current-state と cutover ledgers が過不足なく更新されていること。

## 途中で実行した feed-surface helper deletion candidate の検証

以下を実行済みです。

```sh
PATH=/tmp/codex-pnpm-shim:$HOME/.local/bin:/home/lkjsxc/.cargo/bin:$PATH pnpm test -- \
  tests/unit/feed-surface \
  tests/unit/timeline/timeline-tab-older-requests.test.ts \
  tests/unit/timeline/timeline-reducer.test.ts \
  tests/unit/timeline/timeline-follow-loading.test.ts \
  tests/unit/repo-feed-surface-deletions.test.ts \
  tests/unit/repo-deleted-paths.test.ts
```

結果:

- pass
- Vitest の script behavior により broad suite になった
- 340 files passed
- 1132 tests passed

ただし、この検証は current worktree に対するものです。まだ commit scope を確定していません。index の staged state として検証したわけではありません。

## 現在の主な問題点

### 1. Shared feed runtime は未完了

`docs/execution/current-blockers.md` では、Shared feed runtime が現在の第一未完了 blocker です。
今回の停止点までで完了したのは retained Svelte parity proof の小 slice と Rust/WASM evidence correction です。

まだ未完了:

- Shared feed runtime 全体の cutover 完了。
- Svelte feed surface の削除証明。
- Docker Compose final gate。
- 広い Rust/WASM quiet の安定完走確認。

### 2. dirty worktree が複数 slice をまたいでいる

今の dirty worktree は、少なくとも次の作業が混在しています。

- Rust/WASM feed/runtime parity
- retained Svelte event chrome presenter extraction
- feed-surface helper deletion
- tab island host rewrite
- deletion guard scripts
- docs/ledgers

これを 1 commit にまとめると、レビューも rollback も困難です。次の agent は、最初に staging boundary を決めるべきです。

### 3. `speculative-older.ts` 削除は小さく見えて大きい

`src/lib/feed-surface/speculative-older.ts` は old helper ですが、`HEAD` では Notifications/Profile/Search/Thread/Timeline が import しています。

Timeline だけは current worktree で `src/lib/tabs/timeline/timeline-tab-older-requests.ts` に専用 coordinator を移しています。
しかし他 tab は Rust island rewrite によって import が消えているように見えます。

つまり選択肢は大きく 2 つです。

1. 小 slice として、`feed-scroll-key`, `scroll-intent`, `near-end-observer`, `notification-view-rows` の移動/削除だけを先に commit し、`speculative-older.ts` は残す。
2. 大 slice として、`speculative-older.ts` 削除と複数 tab の Rust island rewrite をまとめて扱う。

1 を選ぶなら、deletion guard/docs から `speculative-older.ts` を一時的に外すか、少なくとも commit scope に含めない調整が必要です。
2 を選ぶなら、focused wasm/browser tests と no-import proof が必要です。

### 4. docs line cap が厳しい

確認時点:

- `docs/current-state.md`: 300 lines
- `docs/execution/current-blockers.md`: 300 lines
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`: 299 lines

これらに追記すると line cap を超えやすいです。以後は、追記ではなく圧縮・置換で更新してください。

### 5. Node engine warning は既知

pnpm 系コマンドで次の warning が出ます。

- project wants Node `>=24.0.0`
- current environment is Node `v22.22.3`

これまでの relevant gates は、この warning の上で pass しています。warning 自体は今回の主問題ではありません。

### 6. `tmp/` は ignore される

この handoff file はユーザー指定により `tmp/` に置いています。
通常の `git add` では staging されないため、commit するには次が必要です。

```sh
git add -f tmp/gpt-5.5-pro-handoff-2026-06-20.md
```

## 次に進める場合の推奨方針

### 推奨 A: まずは「小さく安全な helper deletion」に切る

目的:
`speculative-older.ts` に踏み込まず、feed-surface から明確に移動済みの小 helper だけを片付ける。

候補 scope:

- `src/lib/components/feed/FeedScrollSurface.svelte`
- `src/lib/components/feed/feed-scroll-intent.ts`
- `tests/unit/feed/feed-scroll-intent.test.ts`
- `tests/unit/feed/README.md`
- `src/lib/components/feed/README.md`
- `src/lib/components/events/EventTreeListNearEnd.svelte`
- related near-end plan/test if present
- `src/lib/notifications/notification-view-rows.ts`
- `src/lib/tabs/notifications/NotificationListScroll.svelte`
- `tests/unit/notifications/notification-view-rows.test.ts`
- `tests/unit/cache/pins.test.ts`
- deleted:
  - `src/lib/feed-surface/feed-scroll-key.ts`
  - `src/lib/feed-surface/near-end-observer.ts`
  - `src/lib/feed-surface/notification-view-rows.ts`
  - `src/lib/feed-surface/scroll-intent.ts`
  - old related tests

Do not stage:

- `src/lib/feed-surface/speculative-older.ts`
- `src/lib/tabs/custom-request/CustomRequestTab.svelte`
- `src/lib/tabs/notifications/NotificationsTab.svelte`
- `src/lib/tabs/profile/ProfileTab.svelte`
- `src/lib/tabs/search/SearchTab.svelte`
- `src/lib/tabs/thread/ThreadTab.svelte`
- broad Rust island rewrite files

問題:
current worktree では `speculative-older.ts` deletion と guard/docs updates も混ざっています。
この小 slice を選ぶなら、index staging をかなり慎重に行う必要があります。

### 推奨 B: 「tab island rewrite + speculative older deletion」を大きめ slice として扱う

目的:
`speculative-older.ts` を本当に消すなら、複数 tab の Rust island化と一緒に削除証明する。

候補 scope:

- `src/lib/feed-surface/speculative-older.ts` deletion
- `tests/unit/feed-surface/speculative-older.test.ts` deletion
- `src/lib/tabs/timeline/timeline-tab-older-requests.ts`
- `tests/unit/timeline/timeline-tab-older-requests.test.ts`
- `TimelineTab.svelte`
- `NotificationsTab.svelte`
- `ProfileTab.svelte`
- `SearchTab.svelte`
- `ThreadTab.svelte`
- `CustomRequestTab.svelte` if its island rewrite is part of the same contract
- `src/lib/components/workspace/*-island.ts`
- `RustIslandHost.svelte` / `feed-tab-host.ts` if changed
- repo deletion guard scripts/tests
- docs/ledgers/current-state updates

必要検証:

- `rg` no-import proof for `feed-surface/speculative-older` and `createOlderRequestCoordinator`
- focused Vitest for timeline coordinator, feed tab island guards, deletion guards
- targeted wasm-pack browser tests for affected tabs
- `pnpm check`
- `pnpm check:repo`
- `cargo run -p lkjstr-xtask -- check-docs`
- `cargo run -p lkjstr-xtask -- check-lines`
- `git diff --check`
- if claiming broader runtime completion, Docker Compose final gate

問題:
scope が大きいです。やるなら staged diff のレビューと focused verification をかなり丁寧に行ってください。

### 推奨 C: retained Svelte parity proof の小 slice を続ける

目的:
大きな Rust island deletion に踏み込まず、残存 Svelte event components の duplicated chrome をさらに presenter/plan に寄せる。

利点:

- 小さく commit しやすい。
- rollback しやすい。
- current blocker の parity proof には貢献する。

問題:

- Shared feed runtime 本丸の完了には直接届かない。
- dirty worktree が既に helper deletion/tab island rewrite を含んでいるため、誤 staging のリスクがある。

## Staging/commit の注意

この停止点の後に作業する agent は、まず以下を実行して現在の地形を確認してください。

```sh
git status --short
git diff --name-status
git ls-files --others --exclude-standard
git ls-files --deleted
```

staging は必ず explicit path list で行ってください。

避けること:

```sh
git add -A
git add .
```

理由:
現在の worktree には、検証粒度が異なる複数 slice が混在しているためです。

## Verification policy

小 slice でも最低限:

```sh
pnpm exec prettier --check <touched files>
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
git diff --check
```

TypeScript/Svelte behavior change:

```sh
pnpm test -- <focused tests>
pnpm check
```

Rust/WASM behavior change:

```sh
wasm-pack test --headless --chrome crates/lkjstr-web --test <focused_browser_test>
cargo test -p <crate> <focused_test>
cargo clippy -p <crate> --all-targets -- -D warnings
cargo check -p lkjstr-web --target wasm32-unknown-unknown
```

Shared feed runtime 完了を主張するなら:

- broad quiet gates
- Docker Compose final gate
- no-import proof
- ledger evidence

が必要です。

## 現時点で未実行/未完了として明示すること

- Docker Compose final gate は未実行。
- current dirty worktree 全体に対する full validation は未実行。
- `pnpm rust-wasm:quiet` broad run は、最新 evidence では外部 900s を超過。pass とは言わない。
- feed-surface helper deletion candidate は staged/committed していない。
- tab island rewrite candidate は staged/committed していない。
- Shared feed runtime 全体の完了は未主張。

## この停止点での stop condition

ここで追加実装は止めます。

完了していること:

- EventMeta author identity chrome の shared snippet 化 commit。
- EventRowAvatar retained row avatar chrome の proof commit。
- Rust/WASM verification ledger の evidence correction commit。
- GPT-5.5-Pro 向けの最新 handoff を `tmp/gpt-5.5-pro-handoff-2026-06-20.md` に更新。

未完了として残すこと:

- Shared feed runtime cutover 完了。
- helper deletion の commit boundary 決定。
- `speculative-older.ts` 削除と複数 tab Rust island rewrite の扱い決定。
- dirty worktree の分割 commit。
- full Rust/WASM quiet と Docker final gate。

## 最後に

次の agent は、まず「何を commit するか」ではなく、「どの invariant を証明する commit なのか」を決めてください。

現在の最大リスクは実装難度そのものではなく、複数の正しい方向の変更が dirty worktree に混在し、commit と verification の境界が曖昧になっていることです。

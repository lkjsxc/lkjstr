# GPT-5.5-Pro Handoff: Shared Feed Runtime Checkpoint

作成日時: 2026-06-20T04:38:27Z
リポジトリ: `/home/lkjsxc/workspace/lkjstr`
ブランチ: `main`
状態: 作業は完了ではなく、切りの良いチェックポイントで停止。

## まず伝えたいこと

このリポジトリの現在の第一未完了ブロッカーは、Shared feed runtime
cutover です。SvelteKit/TypeScript の既存プロダクトを保ちながら、
Rust/WASM 側へ feed surface を段階移行している途中です。

今回の停止時点では、「残存 Svelte UI の重複 chrome を presenter/plan
で固定し、共有 snippet に寄せる」小さな安全 slice を進めました。
Shared feed runtime 全体の完了、削除証明、最終 Docker gate 完了はまだ
主張できません。

## 直近で完了した slice

### EventMeta author identity chrome

`src/lib/components/events/EventMeta.svelte` で、openable な author identity
button と static span が同じ author identity chrome を別々に描いていたため、
`identityBody` snippet に集約しました。

対象の表示要素:

- inline avatar
- `strong` 内の `EmojifiedText`
- subtitle の `small`

openable branch は `button`、static branch は `span` のままです。
profile open の条件、クリック動作、pubkey display fallback は変更していません。

追加した presenter proof:

- `tests/unit/events/event-meta-presenter.test.ts`
- `EventMeta` が `identityBody` snippet を持つこと
- `canOpenProfile` が true のとき `button` が `onclick={openProfile}` を持つこと
- false のとき static `span` branch が残ること
- display pubkey, `EmojifiedText`, subtitle が snippet 内にあること
- `{@render identityBody()}` が 2 branch から呼ばれること

関連 docs 更新:

- `src/lib/components/events/README.md`
- `docs/execution/current-blockers.md`
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`

## 直近以前に同じ方向で完了している slice

同じ Shared feed runtime / retained Svelte parity proof の文脈で、以下も進んでいます。
これらはこの停止時点の verification-ledger にまとめて反映されています。

- `MediaAttachment.svelte`: video/audio open button chrome を `openButton` snippet に集約。
- `EventMentionChip.svelte`: mention chip body を shared snippet に集約し、title/raw text は plan 側へ。
- `ProfileMentionChip.svelte`: profile mention chip body を shared snippet に集約。
- `ReactionSummaryActorRow.svelte`: reaction actor row body を shared snippet に集約。
- `EventReferenceCard.svelte`: reference card body と unavailable/media label 周辺の presenter proof が既に存在。

これらは「Svelte を今すぐ消す」作業ではありません。Rust/WASM parity と削除証明が
揃うまで、残る Svelte surface の挙動を小さく固定するための作業です。

## 検証済みのコマンド

EventMeta slice の編集前に behavior lock として以下を実行し、pass:

```sh
pnpm exec vitest run \
  tests/unit/events/event-meta-presenter.test.ts \
  tests/unit/events/event-profile-activation.test.ts \
  tests/unit/events/event-meta-overflow.test.ts \
  tests/unit/events/event-meta-copy-status.test.ts \
  tests/unit/events/event-meta-copy-status-lifecycle.test.ts
```

結果:

- 5 files passed
- 19 tests passed

EventMeta slice の編集後に同じ focused suite を実行し、pass:

- 5 files passed
- 20 tests passed

追加で実行済み:

```sh
pnpm exec eslint \
  src/lib/components/events/EventMeta.svelte \
  tests/unit/events/event-meta-presenter.test.ts
```

```sh
pnpm exec prettier --check \
  src/lib/components/events/EventMeta.svelte \
  tests/unit/events/event-meta-presenter.test.ts \
  src/lib/components/events/README.md \
  docs/execution/current-blockers.md \
  docs/architecture/rust-wasm/cutover/verification-ledger.md
```

```sh
pnpm check
```

```sh
pnpm test -- \
  tests/unit/events/event-meta-presenter.test.ts \
  tests/unit/events/event-profile-activation.test.ts \
  tests/unit/events/event-meta-overflow.test.ts \
  tests/unit/events/event-meta-copy-status.test.ts \
  tests/unit/events/event-meta-copy-status-lifecycle.test.ts \
  tests/unit/events/media-attachment-plan.test.ts \
  tests/unit/events/media-attachment-hitbox.test.ts \
  tests/unit/events/event-media-status-presenter.test.ts
```

この `pnpm test -- ...` は script 側の挙動により広い event suite を走らせています。
確認した結果:

- 340 files passed
- 1132 tests passed

さらに実行済み:

```sh
pnpm check:repo
cargo run -p lkjstr-xtask -- check-docs
cargo run -p lkjstr-xtask -- check-lines
git diff --check
pnpm rust-wasm:quiet
pnpm verify:quiet
```

確認した pass 表示:

- `svelte-check found 0 errors and 0 warnings`
- `ok rust-wasm`
- `ok verify`

最終 docs 更新後にも、対象ファイルの Prettier、`pnpm check:repo`、
`check-docs`、`check-lines`、`git diff --check`、`pnpm verify:quiet` を再実行済み。

## 未実行の重要 gate

Docker Compose final gate は今回 rerun していません。

このため、以下はまだ主張しないでください。

- Shared feed runtime 全体が完了した
- Svelte feed surface を削除できる
- Docker を含む authoritative final gate が通った

## 現在の主な問題点

### 1. Shared feed runtime はまだ完了していない

`docs/execution/current-blockers.md` は、第一未完了 blocker を Shared feed runtime として
扱っています。今回の作業は retained Svelte parity proof を積み上げただけで、
broader feed-surface deletion prerequisites はまだ開いています。

### 2. 削除証明なしに TypeScript/Svelte を消してはいけない

AGENTS.md と `docs/agent/skills/deletion-proof.md` の制約上、TypeScript/Svelte product code
の削除には、Rust parity、focused tests、ledger evidence、no-import proof が必要です。
今回の変更は削除ではありません。

### 3. 作業ツリーが非常に dirty

`git status --short` は多数の modified/deleted/untracked file を示しています。
これは今回の EventMeta slice だけではありません。

広い `git add -A` は危険です。commit は意図した checkpoint file だけに絞るべきです。
未確認の既存変更を revert してはいけません。

### 4. `tmp/` は ignore されている

この handoff は `tmp/` に置く指定だったため、通常の `git add` では staging されません。
commit に含める場合は `git add -f tmp/gpt-5.5-pro-handoff-2026-06-20.md` が必要です。

### 5. docs の line cap に注意

以下は停止時点で 300 lines ぴったりです。

- `docs/execution/current-blockers.md`
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`

以後の編集は追記ではなく、置換・圧縮で line-neutral にする必要があります。

### 6. Node engine warning は既知

pnpm 系コマンドで、project が Node `>=24` を要求し、現在は `v22.22.3` である warning が出ます。
今回の gates はその warning の上で pass しています。

## 今回コミットに含めるべき file

この checkpoint の最小 commit scope:

- `src/lib/components/events/EventMeta.svelte`
- `tests/unit/events/event-meta-presenter.test.ts`
- `src/lib/components/events/README.md`
- `docs/execution/current-blockers.md`
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`
- `tmp/gpt-5.5-pro-handoff-2026-06-20.md`

注意: docs/README/test file には、同じ goal の以前の slice の変更も含まれている可能性があります。
それでも full dirty tree を丸ごと commit するより、この checkpoint とその ledger に絞る方が安全です。

## GPT-5.5-Pro に次に考えてほしいこと

1. まず以下を読む。
   - `AGENTS.md`
   - `docs/current-state.md`
   - `docs/agent/README.md`
   - `docs/execution/current-blockers.md`
   - `docs/agent/skills/feed-runtime.md`
2. Shared feed runtime の本丸を進めるのか、retained Svelte parity proof の次の小 slice を続けるのかを判断する。
3. 小 slice を続けるなら、残る duplicated retained chrome を探し、既存 plan/presenter pattern に沿って固定する。
4. 大きい cutover に戻るなら、provider wiring、deletion ledger、no-import proof、Docker final gate の不足を先に棚卸しする。
5. commit は dirty tree 全体を含めず、証拠と責任範囲が説明できる単位に分ける。
6. 完了主張は focused test、repo/doc/line guards、Rust/WASM、quiet verify、必要なら Docker gate の証拠と一緒に行う。

## Stop condition at this handoff

ここでは追加の feature work を止めます。
完了したのは retained Svelte EventMeta author identity chrome の共有 snippet 化と、
その focused proof/docs/ledger 更新です。

残件は Shared feed runtime 全体の cutover 完了、削除証明、Docker final gate、そして大量の
未整理 dirty worktree の明示的な整理です。

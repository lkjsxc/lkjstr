# Notification delivery

## Purpose

Keep public account notifications responsive through subscription scheduling,
verification and projection, including when the Notifications view is closed.
No notification-specific UI or protocol message is added.

## Demand and lifetime

Each saved discovery account owns one canonical public notification head while
at least one page is visible. The existing 32-account bound applies. Hidden
pages and removed accounts release their ownership; returning pages recreate
demand through the normal connection and request scheduler.

A visible Notifications view or mixed Home/Global/Their Home head shares the
same logical request when its filter matches. Each account keeps its own #p
filter, quota and cursor. Public filters may share a physical envelope only
under the existing public-read, private-list and relay capability checks.
Removing the last notification owner rejects orphan events without replaying
surviving feed members of that envelope.

Canonical notification heads inherit the owning view's focused or visible
priority. Their inclusive history uses the ordinary history priority. Arbitrary
#p hydration filters do not acquire this priority. Thin-link head quotas now
apply to notification heads too; already asked and inclusive history quotas
retain their existing bounds.

After EOSE, heads owned only by saved-account watches yield to initial account
record discovery. Any visible co-owner retains the view priority. This avoids
many saved accounts starving their profile, follow, mute and relay records on
a single-slot relay. Existing connection, subscription, fanout and rotation
bounds remain in force; no periodic polling or extra timer is introduced.

## Inbox permissions

Verified NIP-65 read roles can serve saved-account notifications, including an
inactive account's inbox that is also present as a discovery transport hint.
Hints alone still grant no general read, write or search permission.

Explicit read policy is retained separately from the bounded remembered-relay
cache. At most 64 normalized URL/read decisions are replaced with the current
configuration. An explicit denial survives transport-cache eviction and hint
reinsertion; replacing the configuration releases obsolete denials.

## Verification and projection

Each ordinary verification turn still processes at most 32 events. One bounded
scan can select up to eight public notification candidates for currently saved
accounts or visible notification-bearing views before bulk work. The remaining
operations preserve the existing queue order, so tagged spam cannot monopolize
verification. Tags are scheduling hints: signature checking, mute/visibility
policy, zap evidence, read marks and invalid-event rejection remain unchanged.

The queue remains limited to 4096 events and 32 MiB. Selected events must fit
pending persistence; blocked admission keeps the existing single deletion-proof
control path. No priority scan runs during that admission block. Scope is
recomputed each turn, so removed accounts retain no scheduling privilege.

Ordinary notification rows already stream without waiting for EOSE, actor
profiles or missing subjects. Core dirty-row flushing remains 75 ms; socket
wake and ready verification use the existing 25 ms and 4 ms Worker turns. Zap
receipts still require trusted provider evidence. The frontend renders delivered
rows and patches immediately, including while relay state is still cache.

## Deterministic evidence

The regressions use local signed fixtures and a supplied clock. These numbers
are controlled scheduler observations, not public-relay or browser benchmarks.

| Case | Baseline | Candidate |
| --- | --- | --- |
| Focused mixed Home, one slot/two filters, EOSE held for 4000 ms | #p sent at 4001 ms | Both heads sent at 1 ms |
| Unfocused/mixed notification head on VeryThin | 200-event quota | 8-event quota |
| Saved account with no notification-bearing view | No #p request | #p sent at first connected turn |
| Signed reaction after 1024 bulk notes | Verified in slice 33 | Verified in slice 1 |
| Same reaction, four notification-bearing views and synthetic 4 ms turns | Projected in slice 39 | Projected in slice 1 |

Native controls cover queue fairness, forged candidates, account removal,
hide/reconnect, inbox permissions under cache pressure, shared-wire revocation,
private projection, thin-link history and single-slot discovery. The frontend
control delivers rows and hydration patches with timers frozen and no relay
completion, preserving existing row nodes and head-following behavior.

Account output carries ordinary unread counts. At this revision the top bar's
visible badge is for direct messages; adding an ordinary notification badge is
a separate interface decision. Reading position, Fresh and auto-seen rules are
unchanged.

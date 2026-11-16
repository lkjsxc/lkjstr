# Relay authentication

## Purpose

Describe current relay identity policy, bounds and verification.

## Behavior and identity

The engine handles the challenge, AUTH, OK and auth-required flows in
[NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md).
It signs kind 22242 with the exact relay URL and challenge. Authentication
events use AUTH only; they never enter the event store or publication counts.

A relay challenge alone does not disclose any account. A usable saved signer
must own current work that the relay explicitly refused for lack of
authentication. For public reads this is the currently active account. Private
kind 4/1059 inbox reads may use their own saved account, including an inactive
one. A blocked publication uses its original sender, not whichever account
happens to be active when the relay answers.

Network::publish infers the author only for ordinary events. Gift wraps require
Network::publish_as with an explicit original sender. The Worker passes that
sender for each DM recipient and the self copy. An unowned gift wrap never
authorizes the active account, its ephemeral author or its recipient.
Authentication proves that sender's identity to the relay; it does not make a
promise of sender anonymity from a relay requiring that proof.

Local, extension and connected bunker signing use the same exact-event checks.
Read-only and locked accounts are excluded. Unlocking a key makes it eligible
again; an unavailable key does not consume a challenge attempt.

## Lifetime and failures

Signing job identities increase across the whole Network lifetime. Removing and
re-adding the same relay cannot let an older signer success or failure settle
the replacement job; two native regressions reproduce that former collision.

Signer availability and active identity are refreshed after every committed
account change. Both delayed signer replies and relay acknowledgements recheck
current authorized demand. Switching accounts, locking/removing a signer,
closing the last relevant view or expiring a publication cancels obsolete
work. Cancellation does not reject another account's reads or publications.

Socket disconnect and challenge replacement invalidate older signing jobs.
Successful authentication resumes only that account's blocked work, after the
relay acknowledges AUTH. Failed authentication rejects only matching writes;
delivery progress and stored publication history receive that real failure.
Other accounts can continue their own authentication on the same connection.

One connection accepts at most eight distinct challenges, each no longer than
4096 bytes. There are at most 32 eligible device signers, one pending AUTH per
relay and four concurrent Worker signer jobs. Jobs have a 60-second deadline.
The pre-existing 30-second publication budget is not extended by authentication.
A late acknowledgement cannot resurrect expired work. Pending request IDs and
publication IDs are pruned against their bounded existing collections.

Repeated refusal does not repeatedly prompt the same account for one challenge.
A cancellation caused by changed eligibility permits a fresh job when that
account becomes eligible again. No authentication state survives reconnection.
A signature cannot retroactively revoke identity already disclosed to a relay.

## Verification and remaining scope

Native regressions:
- engine_auth_test.rs: challenge alone, exact event, refusal, reconnect,
  challenge rotation, private inbox ownership and unanswered request state.
- engine_auth_race_test.rs: active switch before signature and before ACK,
  removed demand, lock/re-enable eligibility, and ACK after the deadline.
- engine_auth_write_test.rs: publication owner, scoped accept/refusal progress,
  explicit gift-wrap sender, expired publication and unsuccessful socket send.

The real Worker loopback harness exercises the shared local/extension/bunker
signing path. Gate results and before/after proof belong in docs/status.md and
the landing record; this design note does not claim an unrun browser check.

Optional NIP-67 EOSE auth hints are not yet used to request extra results.
Authentication still requires an explicit auth-required refusal, so this is a
concrete limit rather than complete support for every relay hint. No new
permission dialog, account selector or visible text is introduced here.

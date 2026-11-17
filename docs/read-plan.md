# Read plan: one plan for everything the tabs want

## Purpose

The owner's direction of 2026-11-17, in translation: what the tabs want should be adjusted well in the back end, from
weights, so that the best possible queries are asked of the relays in the best possible way; the moment of display
may not matter; weights should be made well from past information; it should be as good as it can possibly be.

This replaces the withdrawn item S1 (one moment in every tab). Tabs drawing at different moments is accepted. What
is not accepted is a tab asking for what another tab, the store or an earlier session already has, a relay asked
that never held the answer, or a slot spent on something the reader will not look at.

A minute later the owner added: all information should gather in the back end, and very advanced orchestration
should happen there. So every signal lives in the engine and nowhere else: the wants and how they are seen, what the
store holds, what each relay did, what the reader does, every limit. No decision about what to ask, where or when is
made in a tab, a view or a helper beside the engine.

It is engine work with no new surface or word. Index and rules: [interface-specs.md](interface-specs.md). What exists
and what was left out: [outbox.md](outbox.md), [cover.md](cover.md), [orchestration.md](orchestration.md). The
mechanics are the builder's; the statements below are what must be true and how it is measured. A rule in an older
document that stands in the way of a better scorecard yields.

## Q1 Tabs state wants; the engine makes one plan

- A tab (Home, Notifications, a profile, a thread, a channel, a list, search; any pane or browser tab of the device)
  never causes a request by itself. It states a want: which rows (people, kinds, tags, ids), which direction (live,
  newer, older page), for which account, and how it is seen (focused, visible, open but hidden, expected next).
- The engine holds every want of the device in one place and derives the requests from their union. Two wants that
  overlap ask once. A want the store already answers asks only for its gap. An event that arrives serves every want
  it matches, whichever request brought it; no tab waits for a delivery of its own.
- A change in one want (a tab opened, closed, scrolled, hidden) changes only the requests that exist because of it.
  It never closes and reopens what another want still uses, and it never replays what is in flight.
- The plan knows what it could not ask yet (limit, cooldown, no relay known). "End of list" and "nothing here" are
  said only when the plan has proved them, as today.

Check: with Home, Notifications and three profiles of followed people open, the requests on the wire equal those of
the union of wants, not their sum; closing one profile closes nothing another tab uses.

## Q2 Ask where the answer is

- For each wanted person the candidates are the relays of their signed relay list, the relays where their events
  were actually received (this device, any session), relay hints on events that name them, and the reader's own.
- The plan picks the fewest relays that reach every wanted person on two of their relays where two exist, heavier
  people and better relays first, inside the connection limit of the device. Where the limit cannot cover everyone,
  the lightest people lose cover first and Stats says how many.
- This is the author-sharded reading and device-wide cover that outbox.md left out. Its prerequisites named there
  (shard generation evidence, bounded list discovery, one connection allocator for views, hints and publication)
  are part of this item.
- Relays that offer set reconciliation or counts are used for gaps where that is cheaper than a filter.

Check: a fixture where person X writes only to relay B. The first session finds X on B; from then on X is asked on B
and no longer on relays that never returned X, except for the trial share of Q3.

## Q3 Weights made from the past

Three kinds, all kept on the device, per account where they concern a reader, never sent anywhere, bounded and aging
as relay observations already do.

- Relay, per kind of want: share of received events that were new, verified and wanted; time to first event and to
  the end; how far back it really answers; refusals, limits and cooldowns; and per person, whether and when their
  events came from it.
- Person: the fixed steps (self, follows, counterparts, follows of follows, unknown, muted zero) stay as the floor.
  Above the floor, what the reader really does moves a person up: opening their profile or thread, replying,
  reacting, reposting, zapping, writing to them. What the reader passes without ever opening moves slowly down to
  the floor, never below it.
- Want: which tabs this reader opens, how often and after what. A tab opened every day has its gap asked first at
  start; a tab opened once is not prepared in advance.
- A small fixed share of every budget (start at 5 percent) goes to trials: a relay or person with little or old
  evidence. Without it the weights only ever confirm themselves. A relay that became good is found again.
- A new device or account with no past behaves as today: the fixed steps and neutral relays.

Check: after a recorded week of use replayed into a fresh store, the plan of the next start differs from the
no-history plan and scores better on the scorecard below. A relay marked bad that then answers well is in normal use
again within three sessions.

## Q4 Spend where it brings most

- Every limit is a budget: connections of the device, subscriptions and filters of a relay, its rate, the limit a
  relay states. Inside a budget the plan asks first what is expected to bring the most wanted events not yet held:
  how the want is seen, times the weight of its people, times what the relay is expected to return, over its cost.
- The focused want is never behind anything. Every visible want gets a first answer within ten seconds whatever
  the weights say. Hidden and expected-next wants take only what is left.
- No request is sent that the plan expects to return nothing new, apart from the trial share.

Check: with one free slot the focused want goes first; under a tight budget no visible want is unanswered after ten
seconds; a public sample draws no rate-limit notice.

## Q5 A scorecard that is climbed

- One replayable scorecard, on the existing 32-relay/300-author fixture extended with several open tabs and a week
  of recorded behaviour, and on the allowlisted public sample:
  recall (wanted events that exist on any candidate relay and were obtained), requests, connections and duplicate
  wire events per wanted new event, and time to first screen as a guard that must not get worse.
- Stats shows the plan: each want, the requests it shares, each relay with expected and actual return and the
  reason it was chosen. Existing columns are reused; a missing word is reported under this item, not invented.
- Work in a loop: measure, change one thing, keep it only if the scorecard is better, write the line in cover.md.
  Stop when three changes in a row move no number by two percent, and report what limits it then.

## Q6 Lists are kept, not asked again at every start

The owner, 2026-11-17: the relay list seems to be fetched from the default relays every time a page opens; it
should be cached on the device. That is so today (orchestration.md: every saved account requests kinds 0, 3,
10000, 10002 and 10063 at startup independently of cached records). This item replaces that rule.

- Slow lists are records in the store with the time they were last confirmed and where: for the device's accounts
  kinds 0, 3, 10000, 10002, 10050 and 10063; for every wanted person their relay list and profile.
- A start uses the stored lists at once. The first connections go to the relays of the stored list, not to the
  default relays, and no list is requested before the visible tabs have their content.
- The device's accounts: after the first content, one request for all accounts and kinds together, only for what
  is newer than the stored records, on the accounts' own relays; then a live want for the same while a page is
  open, so an edit made in another client arrives by itself. Never one request per kind and account per start.
- Other people: a stored list is confirmed again only when it is old (start: followed people 24 hours, others 7
  days, shorter for heavier people, the scorecard decides), when evidence says it is stale (a newer one seen in
  passing, a hint naming a relay the list lacks, the person no longer found where the list says), or when the
  reader asks in Settings or on the profile. Confirmations are batched by relay and ask only for newer.
- The default relays and indexers are the last place a list is looked for: only when nothing is stored and no hint
  answered. They are not a step every start passes through.
- A stored list that fails verification or is older than a stored newer one is never used. An account's records
  are cleared with the account's data.
- The scorecard of Q5 gains two numbers: list requests per start, and starts that reached first content without
  touching a default relay.

Check: second start of a signed-in account with a filled store and every default relay unreachable: the feed
appears from the account's own relays and the request log holds no list request before first content and at most
one batched one after it. A relay list changed in another client is in use here within a minute while a page is
open, and after the first content of the next start otherwise.

## Q7 A wider set to start from

The owner, same message: the default relays feel too few. Today there are three for reading and writing and two
for search, one list for every purpose.

- Three sets by purpose, each in one place in the source with the date it was last measured: general (reading and
  writing for a reader with no list of their own, and the fallback of Q2), up to eight; indexers (asked only for
  profiles and lists, written to only with list events), up to four; search, up to three. The wire limit of eight
  rises to fit. A reader's own saved list keeps its present limit and always wins.
- More defaults do not mean more connections: the plan of Q2 to Q4 picks among them inside the device limit, and
  with Q6 a reader who has a list rarely touches them. A new account publishes to at most four general relays.
- Candidates, to be measured, not trusted: general relay.damus.io, nos.lol, yabu.me, relay.primal.net,
  relay.nostr.wirednet.jp, r.kojira.io, nrelay.c-stellar.net, nostr.mom, relay.snort.social, offchain.pub;
  indexers purplepag.es, user.kindpag.es, indexer.coracle.social, directory.yabu.me; search search.nos.today,
  relay.nostr.band, relay.noswhere.com. Add better ones you know of.
- A relay enters a set only if, from a browser at the production origin, on three runs hours apart, it connects,
  needs no payment or sign-in to read, answers a first filter of its purpose within three seconds, and its stated
  limits fit. At least three general relays are ones where Japanese is written every hour. The same measurement
  is a script run at each ship; a default that fails it twice running is named in the ship record and replaced.
- No new surface or word. The sentence about reading from default relays stays as it is.

Check: the measurement script passes for every default; a fresh profile with no account shows a feed with two of
the general relays blocked; the scorecard does not fall against the three-relay set.

## Order

Q1 first: it is the base of the others and of the cache and first-paint work in progress. Then Q2, Q3, Q4; Q5's
scorecard is made with Q1 and used from then on. Each lands and ships alone. A1 and A2 are small and visible and
are not delayed by this: take them between two of these items at the latest. Q6 is part of the cache work and
lands with Q1 or straight after it; Q7 is small and ships with the next ship that has room.

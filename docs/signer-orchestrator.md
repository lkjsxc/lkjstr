# Extension signer orchestration

## Purpose

The browser extension is a sibling of the [fetch orchestrator](fetch-orchestrator.md).
Both plan eligible work from explicit demand, class weights, finite budgets
and scoped owners. Relay fetches spend connection and byte budgets. Extension
work spends an invocation slot and a background admission budget on its
owning page. Public reads, paints and navigation run while that slot is held.

## Work and budgets

The Worker classifies signer demand before handing the browser its request.
The page chooses the highest eligible weight and uses arrival order to
break ties. The bound applies to logical requests, which can each need
multiple extension methods.

| Demand | Weight |
| --- | ---: |
| Explicit publication | 16 |
| Other user actions, including identity lookup, private sends and publish AUTH | 8 |
| Visible private content and its relay AUTH | 4 |
| Background relay AUTH and passive private reads | 2 |
| Lazy private list decrypts | 1 |

The page admits up to 128 requests and one physical extension method at
a time. A new background or list request can start at most once per two
seconds. Admitted requests can continue within their budget while a new
background request cools down. The planner checks higher-weight arrivals
between methods, including the identity checks that surround a decrypt.
The two-second budget is a fixed starting policy. The latency metrics
observe the workload without changing the weights.

The earlier Worker deadline or 60 seconds bounds queue and method time.
The Worker authorizes an exact event and revalidates each signed reply.
The browser cannot dismiss an open NIP-07 prompt. Its slot remains held
until the extension replies or the deadline passes.

## Shared demand and cancellation

A relay has one pending authentication per socket challenge and account.
Repeated challenges share the socket's bounded challenge history. A
new socket starts a new authorization lifetime. Releasing the last AUTH
demand cancels the page's pending signature. A list job is keyed by
the signed list event and authority; several views may need the same job.

The page coalesces concurrent identical decrypts with the same account,
peer, operation, ciphertext, authority epoch and view scope. Each request
retains its own cancellation and reply. The physical call can settle the
remaining owners if one owner releases it. Closing a view, revoking
authority or replacing the connection releases queued demand and discards
unowned results. The bridge discards replies after their deadline.

## Evidence

The signer smoke sends eight controlled background sign intents to the
real browser bridge while a loopback Worker receives the Post. It keeps
the first extension call open, then checks that Post takes the next slot
before any queued AUTH can start. A separate control watches public
bookmark windows and painted rows while Post remains unanswered. Stats
reports actual pending work during the hold and clears it on settlement.
The fixture sends the resulting Post only to its loopback relay.

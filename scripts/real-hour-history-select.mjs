// Selection uses independently returned, native-verified public events only.
// This module never reads an application result, DOM, cache, or reply-count hint.
const order = (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id);
export function candidateFoci(events, policy, relationships) {
  const accepted = new Set(policy.eligible), counts = new Map();
  for (const relation of relationships) if (relation.parent)
    counts.set(relation.parent, (counts.get(relation.parent) ?? 0) + 1);
  return events.filter(event => event.kind === 1 && accepted.has(event.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || order(a, b))
    .slice(0, 3).map(event => event.id);
}
export function historicalSelection(events, native, foci, span) {
  const byId = new Map(events.map(event => [event.id, event]));
  const notifications = (native.eligibility.notifications?.eligible ?? [])
    .map(id => byId.get(id)).filter(event => event?.kind === 1).sort(order).slice(0, 20);
  const relations = new Map((native.relationships ?? []).map(relation => [relation.id, relation]));
  const threadCandidates = foci.map((focus, index) => {
    const eligible = native.eligibility['thread' + index]?.eligible ?? [];
    const replies = eligible.map(id => byId.get(id))
      .filter(event => event && [1, 42].includes(event.kind) && relations.get(event.id)?.parent === focus)
      .sort(order).slice(0, 20);
    return { focus, ids: replies.map(event => event.id), directReplies: replies.length };
  });
  const thread = threadCandidates.find(candidate => candidate.directReplies >= 2);
  return { span, notifications: { ids: notifications.map(event => event.id), minimum: 3,
    availability: notifications.length >= 3 ? 'informative' : 'uninformative: fewer than three eligible text notifications' },
    thread: thread ? { ...thread, minimum: 2, availability: 'informative' }
      : { minimum: 2, availability: 'uninformative: no candidate has two native direct replies' },
    threadCandidates,
    informative: notifications.length >= 3 && !!thread };
}

use super::*;
/// Called before every challenge, at account commit, input, detach, stop and every pump.
pub(in crate::worker) fn sync(h: &mut Host) {
    if h.bunker.book.is_empty() && h.bunker.flights.is_empty() {
        return;
    }
    let (clients, accounts) = context(h, None);
    let at = h.time();
    let ended = h.bunker.book.sync(
        &policy::Context {
            clients: &clients,
            accounts: &accounts,
        },
        at,
    );
    for job in ended {
        release(h, job);
    }
    let aborted = h
        .bunker
        .flights
        .iter()
        .filter_map(|(lease, flight)| flight.reason.get().map(|reason| (*lease, reason)))
        .collect::<Vec<_>>();
    for (lease, reason) in aborted {
        end(h, lease, reason);
    }
}
pub(in crate::worker) fn input(h: &mut Host, client: u64, input: &I) -> bool {
    let I::SignerAuthCancel { id, reason } = input else {
        return false;
    };
    sync(h);
    if id.len() > 128 {
        return true;
    }
    if reason
        .as_deref()
        .is_some_and(|reason| reason != "unsupported")
    {
        return true;
    }
    let lease = h
        .bunker
        .flights
        .iter()
        .find(|(_, flight)| flight.handle == *id)
        .map(|(lease, _)| *lease);
    if let Some(ended) = lease.and_then(|lease| {
        h.bunker
            .book
            .cancel(client, lease, reason.as_deref() == Some("unsupported"))
    }) {
        release(h, ended);
    }
    true
}

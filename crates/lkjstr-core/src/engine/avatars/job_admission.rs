use super::*;
impl Book {
    /// Request IDs are unique within a client connection; transport replay is idempotent while pending.
    pub fn want(&mut self, owner: Owner, key: &str, now: u64) -> Vec<Command> {
        self.want_observed(owner, key, now, false)
    }
    pub fn want_observed(
        &mut self,
        owner: Owner,
        key: &str,
        now: u64,
        observe_public: bool,
    ) -> Vec<Command> {
        let respond = |result| {
            vec![Command::Reply {
                owner: owner.clone(),
                job: None,
                result,
            }]
        };
        if owner.request.is_empty()
            || owner.request.len() > MAX_REQUEST_BYTES
            || key.len() > super::super::MAX_URL_BYTES
        {
            return respond(ResultKind::Rejected);
        }
        if let Some(id) = self.owners.get(&owner) {
            return if self.jobs[id].key == key {
                Vec::new()
            } else {
                respond(ResultKind::Rejected)
            };
        }
        if crate::store::Profile::is_inline_image(key) {
            return respond(ResultKind::Fallback { uniform: false });
        }
        let Some(host) = host(key) else {
            return respond(ResultKind::Rejected);
        };
        self.negatives.retain(|_, value| value.until > now);
        if let Some(negative) = self.negatives.get(key) {
            return respond(negative.failure.result());
        }
        let client: Vec<_> = self
            .owners
            .iter()
            .filter(|(current, _)| current.client == owner.client)
            .collect();
        let client_urls: BTreeSet<_> = client
            .iter()
            .map(|(_, id)| self.jobs[id].key.as_str())
            .collect();
        if self.owners.len() >= MAX_OWNERS
            || client.len() >= MAX_CLIENT_OWNERS
            || !client_urls.contains(key) && client_urls.len() >= MAX_CLIENT_URLS
            || !self.urls.contains_key(key) && self.jobs.len() >= MAX_JOBS
        {
            return respond(ResultKind::Deferred { retry_ms: 100 });
        }
        let id = if let Some(id) = self.urls.get(key) {
            *id
        } else {
            let Some(id) = self.next.checked_add(1) else {
                return respond(ResultKind::Rejected);
            };
            self.next = id;
            self.jobs.insert(
                id,
                Job {
                    key: key.to_owned(),
                    host,
                    owners: BTreeSet::new(),
                    stage: Stage::Lookup,
                    active: false,
                    started: 0,
                    deadline: 0,
                    spent: 0,
                    persist: true,
                    observe_public,
                },
            );
            self.urls.insert(key.to_owned(), id);
            id
        };
        let Some(job) = self.jobs.get_mut(&id) else {
            return respond(ResultKind::Rejected);
        };
        job.owners.insert(owner.clone());
        self.owners.insert(owner, id);
        Vec::new()
    }
    pub fn release(&mut self, owner: &Owner) -> Vec<Command> {
        let Some(id) = self.owners.remove(owner) else {
            return Vec::new();
        };
        let Some(job) = self.jobs.get_mut(&id) else {
            return Vec::new();
        };
        job.owners.remove(owner);
        if !job.owners.is_empty() {
            return Vec::new();
        }
        let ticket = job.ticket(id);
        let active = job.active;
        self.unmap(id);
        if active {
            vec![Command::Abort(ticket)]
        } else {
            self.jobs.remove(&id);
            vec![Command::Release(id)]
        }
    }
    pub fn detach(&mut self, client: u64) -> Vec<Command> {
        let owners: Vec<_> = self
            .owners
            .keys()
            .filter(|owner| owner.client == client)
            .cloned()
            .collect();
        owners
            .iter()
            .flat_map(|owner| self.release(owner))
            .collect()
    }
}

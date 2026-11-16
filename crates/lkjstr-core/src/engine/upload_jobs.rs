//! Four leased upload jobs; old completions cannot consume a reused request.
use std::collections::BTreeMap;
pub const MAX_JOBS: usize = 4;
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Lease {
    client: u64,
    request: String,
    generation: u64,
}
impl Lease {
    pub fn client(&self) -> u64 {
        self.client
    }
    pub fn request(&self) -> &str {
        &self.request
    }
}
#[derive(Default)]
pub struct Jobs {
    next: u64,
    active: BTreeMap<(u64, String), u64>,
}
impl Jobs {
    pub fn begin(&mut self, client: u64, request: &str) -> Result<Lease, &'static str> {
        if request.is_empty() || request.len() > 256 {
            return Err("rejected");
        }
        let key = (client, request.to_owned());
        if self.active.contains_key(&key) {
            return Err("rejected");
        }
        if self.active.len() >= MAX_JOBS {
            return Err("too-large");
        }
        self.next = self.next.checked_add(1).ok_or("internal")?;
        self.active.insert(key, self.next);
        Ok(Lease {
            client,
            request: request.to_owned(),
            generation: self.next,
        })
    }
    pub fn current(&self, lease: &Lease) -> bool {
        self.active.get(&(lease.client, lease.request.clone())) == Some(&lease.generation)
    }
    /// Exactly one normal terminal result may consume this generation.
    pub fn finish(&mut self, lease: &Lease) -> bool {
        if !self.current(lease) {
            return false;
        }
        self.active.remove(&(lease.client, lease.request.clone()));
        true
    }
    /// The caller emits one explicit cancelled terminal result when this succeeds.
    pub fn cancel(&mut self, client: u64, request: &str) -> Option<Lease> {
        self.active
            .remove(&(client, request.to_owned()))
            .map(|generation| Lease {
                client,
                request: request.to_owned(),
                generation,
            })
    }
    pub fn leases(&self) -> Vec<Lease> {
        self.active
            .iter()
            .map(|((client, request), generation)| Lease {
                client: *client,
                request: request.clone(),
                generation: *generation,
            })
            .collect()
    }
}

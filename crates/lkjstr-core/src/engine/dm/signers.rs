//! One external private signer call per account; revocation consumes old identities.
use std::collections::{BTreeMap, BTreeSet};
#[path = "signers_types.rs"]
mod types;
use types::{Account, Call};
pub use types::{Failure, Lease, Read};
#[derive(Default)]
pub struct Gate {
    accounts: BTreeMap<String, Account>, // <=32 usable accounts
    calls: BTreeMap<u64, Call>,          // <=8 queued/running external operations
    serial: u64,
}
impl Gate {
    fn next(&mut self) -> Result<u64, &'static str> {
        self.serial = self.serial.checked_add(1).ok_or("internal")?;
        Ok(self.serial)
    }
    pub fn sync(&mut self, available: &BTreeMap<String, (u64, bool)>, clients: &BTreeSet<u64>) {
        let kept: BTreeSet<_> = available.keys().take(32).cloned().collect();
        self.accounts.retain(|key, a| {
            kept.contains(key) && available.get(key).is_some_and(|(n, _)| *n == a.epoch)
        });
        for (key, (epoch, visible)) in available.iter().take(32) {
            let a = self.accounts.entry(key.clone()).or_insert(Account {
                epoch: *epoch,
                visible: *visible,
                failure: None,
                reading: None,
            });
            a.visible = *visible;
            if a.reading
                .as_ref()
                .is_some_and(|r| !*visible || !clients.contains(&r.client))
            {
                a.reading = None;
            }
        }
        self.calls.retain(|_, call| {
            let l = &call.lease;
            clients.contains(&l.client)
                && self.accounts.get(&l.account).is_some_and(|a| {
                    a.epoch == l.epoch
                        && a.failure.is_none()
                        && l.read
                            .is_none_or(|n| a.reading.as_ref().is_some_and(|r| r.serial == n))
                })
        });
    }
    pub fn failure(&self, account: &str) -> Option<Failure> {
        self.accounts.get(account).and_then(|a| a.failure)
    }
    pub fn allowed(&self, account: &str, epoch: u64) -> Result<(), &'static str> {
        let a = self
            .accounts
            .get(account)
            .filter(|a| a.epoch == epoch)
            .ok_or("signer-missing")?;
        a.failure.map_or(Ok(()), |f| Err(f.code()))
    }
    pub fn reads(&self) -> Vec<Read> {
        self.accounts
            .values()
            .filter_map(|a| a.reading.clone())
            .collect()
    }
    pub fn reading(&self, account: &str) -> bool {
        self.accounts
            .get(account)
            .is_some_and(|a| a.reading.is_some())
    }
    pub fn current_read(&self, read: &Read) -> bool {
        self.accounts
            .get(&read.account)
            .and_then(|a| a.reading.as_ref())
            == Some(read)
    }
    pub fn begin_read(
        &mut self,
        account: &str,
        client: u64,
        epoch: u64,
        event: &str,
    ) -> Result<Read, &'static str> {
        self.allowed(account, epoch)?;
        let a = &self.accounts[account];
        if !a.visible {
            return Err("offline");
        }
        if a.reading.is_some() || self.reads().len() >= 2 {
            return Err("rate-limited");
        }
        if event.len() > 256 {
            return Err("too-large");
        }
        let read = Read {
            serial: self.next()?,
            account: account.into(),
            client,
            epoch,
            event: event.into(),
        };
        self.accounts.get_mut(account).ok_or("internal")?.reading = Some(read.clone());
        Ok(read)
    }
    pub fn finish_read(&mut self, read: &Read) -> bool {
        if !self.current_read(read) {
            return false;
        }
        if let Some(account) = self.accounts.get_mut(&read.account) {
            account.reading = None;
            true
        } else {
            false
        }
    }
    pub fn retry(&mut self, account: &str) {
        if let Some(a) = self.accounts.get_mut(account) {
            a.failure = None;
            a.reading = None;
        }
        self.calls
            .retain(|_, c| c.lease.account != account || c.lease.read.is_none());
    }
    pub fn begin(
        &mut self,
        account: &str,
        client: u64,
        epoch: u64,
        read: Option<&Read>,
    ) -> Result<Lease, &'static str> {
        self.allowed(account, epoch)?;
        if read.is_some_and(|r| {
            r.account != account || r.client != client || r.epoch != epoch || !self.current_read(r)
        }) {
            return Err("offline");
        }
        if self.calls.len() >= 8 {
            return Err("too-large");
        }
        let lease = Lease {
            serial: self.next()?,
            account: account.into(),
            client,
            epoch,
            read: read.map(|r| r.serial),
        };
        self.calls.insert(
            lease.serial,
            Call {
                lease: lease.clone(),
                running: false,
            },
        );
        Ok(lease)
    }
    pub fn current(&self, lease: &Lease) -> bool {
        self.calls
            .get(&lease.serial)
            .is_some_and(|c| c.lease == *lease)
    }
    pub fn start(&mut self) -> Vec<Lease> {
        let mut occupied = BTreeSet::new();
        let mut ready = Vec::new();
        for call in self.calls.values_mut() {
            if occupied.insert(call.lease.account.clone()) && !call.running {
                call.running = true;
                ready.push(call.lease.clone());
            }
        }
        ready
    }
    pub fn finish(&mut self, lease: &Lease) -> bool {
        if !self.current(lease) {
            return false;
        }
        self.calls.remove(&lease.serial);
        true
    }
    pub fn pause(&mut self, lease: &Lease, failure: Failure) -> bool {
        if !self
            .calls
            .get(&lease.serial)
            .is_some_and(|c| c.running && c.lease == *lease)
        {
            return false;
        }
        if let Some(a) = self.accounts.get_mut(&lease.account) {
            a.failure = Some(failure);
            a.reading = None;
        }
        self.calls.retain(|_, c| c.lease.account != lease.account);
        true
    }
}

//! A lock waits for acknowledged private editors. Expiry cannot certify a dirty draft as saved.
use std::collections::{BTreeMap, BTreeSet};
pub const MAX_EDITORS: usize = 128;
pub const MAX_PER_CLIENT: usize = 32;
pub const PREPARE_MS: u64 = 15000;
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ticket {
    pub req: String,
    pub account: String,
    pub clients: BTreeSet<u64>,
}
struct Editor {
    client: Option<u64>,
    account: String,
    dirty: bool,
}
struct Attempt {
    ticket: Ticket,
    pending: BTreeSet<u64>,
    until: u64,
    failed: bool,
    committing: bool,
}
#[derive(Default)]
pub struct Editors {
    editors: BTreeMap<String, Editor>, // <=128 opaque page/store UUIDs, no body or key
    attempt: Option<Attempt>,          // account mutations serialize; <=32 participant clients
    serial: u64,
}
impl Editors {
    pub fn register(
        &mut self,
        client: u64,
        account: &str,
        editor: &str,
        dirty: Option<bool>,
    ) -> Result<(), &'static str> {
        if !lkjstr_protocol::is_pubkey(account)
            || editor.is_empty()
            || editor.len() > 128
            || !editor
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err("rejected");
        }
        let prior = self.editors.get(editor);
        if prior.is_some_and(|e| e.account != account) {
            return Err("rejected");
        }
        let unchanged = prior.is_some_and(|e| e.client == Some(client));
        if let Some(a) = self
            .attempt
            .as_mut()
            .filter(|a| a.ticket.account == account)
        {
            // An admitted store may finish its current write, but no editor can join the commit.
            if !unchanged || (a.committing && dirty == Some(true)) {
                return Err("internal");
            }
            if dirty == Some(true) && !a.pending.contains(&client) {
                a.failed = true;
            }
        }
        if !unchanged
            && (prior.is_none() && self.editors.len() >= MAX_EDITORS
                || self
                    .editors
                    .values()
                    .filter(|e| e.client == Some(client))
                    .count()
                    >= MAX_PER_CLIENT)
        {
            return Err("too-large");
        }
        let pending = dirty.unwrap_or_else(|| prior.is_some_and(|e| e.dirty));
        self.editors.insert(
            editor.into(),
            Editor {
                client: Some(client),
                account: account.into(),
                dirty: pending,
            },
        );
        Ok(())
    }
    pub fn unregister(&mut self, client: u64, account: &str, editor: &str) {
        if self
            .editors
            .get(editor)
            .is_some_and(|e| e.client == Some(client) && e.account == account)
        {
            self.editors.remove(editor);
            self.departed(client, account);
        }
    }
    pub fn detach(&mut self, client: u64) {
        let accounts: BTreeSet<_> = self
            .editors
            .values()
            .filter(|e| e.client == Some(client))
            .map(|e| e.account.clone())
            .collect();
        for account in accounts {
            self.departed(client, &account);
        }
        self.editors.retain(|_, e| e.client != Some(client));
    }
    pub fn expire(&mut self, client: u64) {
        let accounts: BTreeSet<_> = self
            .editors
            .values()
            .filter(|e| e.client == Some(client))
            .map(|e| e.account.clone())
            .collect();
        for account in accounts {
            self.departed(client, &account);
        }
        for e in self
            .editors
            .values_mut()
            .filter(|e| e.client == Some(client))
        {
            e.client = None;
            e.dirty = true; // Its first dirty frame may still be queued at expiry.
        }
    }
    fn departed(&mut self, client: u64, account: &str) {
        if let Some(a) = self.attempt.as_mut()
            && a.ticket.account == account
            && !a.committing
            && a.pending.contains(&client)
        {
            a.failed = true;
        }
    }
    pub fn retain(&mut self, accounts: &BTreeSet<String>, clients: &BTreeSet<u64>) {
        let stale: BTreeSet<_> = self
            .editors
            .values()
            .filter_map(|e| e.client)
            .filter(|id| !clients.contains(id))
            .collect();
        for client in stale {
            self.expire(client);
        }
        let revoked: Vec<_> = self
            .editors
            .values()
            .filter(|e| !accounts.contains(&e.account))
            .filter_map(|e| e.client.map(|id| (id, e.account.clone())))
            .collect();
        for (client, account) in revoked {
            self.departed(client, &account);
        }
        self.editors.retain(|_, e| accounts.contains(&e.account));
    }
    pub fn begin(
        &mut self,
        account: &str,
        now: u64,
        namespace: &str,
    ) -> Result<Ticket, &'static str> {
        if self.attempt.is_some() || namespace.is_empty() || namespace.len() > 64 {
            return Err("internal");
        }
        self.serial = self.serial.checked_add(1).ok_or("internal")?;
        let clients: BTreeSet<_> = self
            .editors
            .values()
            .filter(|e| e.account == account)
            .filter_map(|e| e.client)
            .collect();
        let failed = self
            .editors
            .values()
            .any(|e| e.account == account && e.client.is_none() && e.dirty);
        let ticket = Ticket {
            req: format!("dm-flush-{namespace}-{}", self.serial),
            account: account.into(),
            clients: clients.clone(),
        };
        self.attempt = Some(Attempt {
            ticket: ticket.clone(),
            pending: clients,
            until: now.saturating_add(PREPARE_MS),
            failed,
            committing: false,
        });
        Ok(ticket)
    }
    pub fn answer(&mut self, client: u64, req: &str, ok: bool) {
        let Some(a) = self.attempt.as_mut() else {
            return;
        };
        if a.ticket.req != req
            || a.committing
            || a.pending.first() != Some(&client)
            || !a.pending.remove(&client)
        {
            return;
        }
        // A stale flush acknowledgement cannot override the editor's latest dirty transition.
        if !ok
            || self
                .editors
                .values()
                .any(|e| e.client == Some(client) && e.account == a.ticket.account && e.dirty)
        {
            a.failed = true;
        }
    }
    /// Success closes admission until finish, including an initially empty set.
    pub fn decision(&mut self, req: &str, now: u64) -> Option<bool> {
        let Some(a) = self.attempt.as_mut().filter(|a| a.ticket.req == req) else {
            return Some(false);
        };
        if a.committing {
            return Some(true);
        }
        if a.failed || now >= a.until {
            return Some(false);
        }
        if a.pending.is_empty() {
            a.committing = true;
            return Some(true);
        }
        None
    }
    pub fn next(&self, req: &str) -> Option<u64> {
        self.attempt
            .as_ref()
            .filter(|a| a.ticket.req == req && !a.failed && !a.committing)
            .and_then(|a| a.pending.first().copied())
    }
    pub fn finish(&mut self, req: &str) -> Option<Ticket> {
        if self.attempt.as_ref().is_some_and(|a| a.ticket.req == req) {
            self.attempt.take().map(|a| a.ticket)
        } else {
            None
        }
    }
}

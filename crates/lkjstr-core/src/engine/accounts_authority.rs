//! Nonsecret Worker-lifetime authority changes only for successful signer replacement.
use super::Account;
impl Account {
    pub fn authority(&self) -> u64 {
        self.authority
    }
    pub(super) fn renew_authority(&mut self) -> Result<(), &'static str> {
        self.authority = self.authority.checked_add(1).ok_or("internal")?;
        Ok(())
    }
}

//! Device-key crypto is computed here, never exported to a frontend or signer bridge.
use super::Accounts;
impl Accounts {
    /// None delegates to a selected external signer. Legacy encryption is intentionally absent.
    pub fn crypt(
        &self,
        account: &str,
        peer: &str,
        operation: &str,
        data: &str,
        nonce: &[u8; 32],
    ) -> Result<Option<String>, &'static str> {
        self.require_signer(account)?;
        if !matches!(
            operation,
            "nip44.encrypt" | "nip44.decrypt" | "nip04.decrypt"
        ) {
            return Err("unsupported");
        }
        let peer = lkjstr_nips::unhex::<32>(peer).map_err(|_| "rejected")?;
        let a = self
            .entries
            .iter()
            .find(|a| a.pubkey == account)
            .ok_or("signed-out")?;
        if a.signer != "local" {
            return Ok(None);
        }
        let secret = a.local_key()?;
        let result = match operation {
            "nip04.decrypt" => lkjstr_nips::nip04::decrypt(data, &secret, &peer),
            "nip44.encrypt" => {
                let key =
                    lkjstr_nips::nip44::conversation_key(&secret, &peer).map_err(|_| "rejected")?;
                lkjstr_nips::nip44::encrypt(data, &key, nonce)
            }
            _ => {
                let key =
                    lkjstr_nips::nip44::conversation_key(&secret, &peer).map_err(|_| "rejected")?;
                lkjstr_nips::nip44::decrypt(data, &key)
            }
        };
        result.map(Some).map_err(|_| "rejected")
    }
}

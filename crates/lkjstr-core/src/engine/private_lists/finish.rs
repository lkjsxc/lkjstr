use super::*;
use crate::engine::accounts::secret::SecretText;
impl Reads {
    /// Validate a completion against the exact account, event, job and current demand.
    pub fn finish(
        &mut self,
        store: &Store,
        job: &Job,
        result: Result<String, &'static str>,
        now: u64,
        asked: bool,
    ) -> Option<Vec<Vec<String>>> {
        let result = result.map(SecretText::new);
        if !self.current(job, now) || !current(store, &job.event) {
            return None;
        }
        let parsed = result.and_then(|text| {
            lkjstr_nips::list_read::entries(&text).map_err(|e| {
                if e == lkjstr_nips::Error::Size {
                    "too-large"
                } else {
                    "rejected"
                }
            })
        });
        let parsed = parsed.and_then(|entries| {
            if self.bytes().saturating_add(entries.allocated) > MAX_BYTES {
                Err("too-large")
            } else {
                Ok(entries)
            }
        });
        let record = self.records.get_mut(&job.event)?;
        let out = match parsed {
            Ok(entries) => {
                record.phase = Phase::Ready;
                record.bytes = entries.allocated;
                Some(entries.tags)
            }
            Err(code) => {
                let code = match code {
                    "unsupported" | "signer-refused" | "signer-timeout" | "signer-missing"
                    | "too-large" | "offline" | "rejected" => code,
                    _ => "internal",
                };
                record.phase = Phase::Failed(code);
                if code == "unsupported" {
                    self.unsupported.insert((job.account.clone(), job.format));
                } else if asked
                    && matches!(code, "signer-refused" | "signer-timeout" | "signer-missing")
                {
                    self.failures.insert(job.account.clone(), code);
                }
                None
            }
        };
        self.changed();
        out
    }
}

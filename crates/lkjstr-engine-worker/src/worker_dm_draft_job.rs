//! Merge only the caller's unchanged tab after a ciphertext CAS conflict; never resend.
use super::*;
pub(super) struct Outcome {
    pub state: Option<policy::State>,
    pub revision: String,
}
pub(super) async fn run(host: &Rc<RefCell<Host>>, id: u64) -> Result<Outcome, &'static str> {
    let mut slot = storage::read(host, id).await?;
    let generation = slot.generation.clone();
    for attempt in 0..3 {
        check(&host.borrow(), id)?;
        if slot.generation != generation {
            return Err("rejected");
        }
        let envelope = slot
            .raw
            .as_deref()
            .map(policy::Envelope::parse)
            .transpose()?;
        {
            let h = host.borrow();
            let task = h.dm.drafts.jobs.get(&id).ok_or("signer-missing")?;
            if envelope.is_none() {
                let revision = policy::Catalog::default().check_revision(
                    &task.account,
                    &task.tab,
                    &generation,
                    task.expected.as_deref(),
                )?;
                if matches!(task.operation, Operation::Clear) {
                    return Ok(Outcome {
                        state: None,
                        revision,
                    });
                }
            }
        }
        key::ensure(host, id, &generation, envelope.as_ref()).await?;
        check(&host.borrow(), id)?;
        // No plaintext, private key, or RefCell borrow survives the following storage wait.
        let prepared = {
            let mut h = host.borrow_mut();
            check(&h, id)?;
            let task = h.dm.drafts.jobs.get(&id).ok_or("signer-missing")?;
            let cached =
                h.dm.drafts
                    .keys
                    .get(&task.account)
                    .ok_or("signer-missing")?;
            if cached.epoch != task.epoch || cached.generation != generation {
                return Err("signer-missing");
            }
            let mut catalog = match &envelope {
                Some(envelope) => policy::open(&task.account, envelope, &cached.key)?,
                None => policy::Catalog::default(),
            };
            let revision = catalog.check_revision(
                &task.account,
                &task.tab,
                &generation,
                task.expected.as_deref(),
            )?;
            if matches!(task.operation, Operation::Load) && envelope.is_some() {
                return Ok(Outcome {
                    state: catalog.get(&task.tab).cloned(),
                    revision,
                });
            }
            let baseline = task.baseline.clone().unwrap_or(catalog.stamp(&task.tab)?);
            let next = match &task.operation {
                Operation::Save(state) => Some(state.clone()),
                Operation::Clear => None,
                Operation::Load => None,
            };
            // A first load establishes its seed before an editor can accept unsaved text.
            // It creates an encrypted empty catalog, never an empty tab record.
            let changed = if matches!(task.operation, Operation::Load) {
                true
            } else {
                catalog.apply(&task.tab, next, baseline.as_deref())?
            };
            if !changed {
                return Ok(Outcome {
                    state: None,
                    revision,
                });
            }
            let revision = catalog.revision(&task.account, &task.tab, &generation)?;
            let batch = lkjstr_nips::hex(&crate::browser::random_bytes::<16>()?);
            let raw = policy::seal(
                &task.account,
                &catalog,
                &cached.key,
                cached.wrapped_seed.clone().ok_or("internal")?,
                &batch,
                crypto::random,
            )?
            .encoded()?;
            if let Some(task) = h.dm.drafts.jobs.get_mut(&id) {
                task.baseline = Some(baseline);
            }
            (raw, revision)
        };
        let change = idb_drafts::Change::Compare {
            generation: generation.clone(),
            expected: slot.raw.take(),
            value: prepared.0,
        };
        match storage::access(host, id, change).await? {
            idb_drafts::Reply::Compared(true) => {
                return Ok(Outcome {
                    state: None,
                    revision: prepared.1,
                });
            }
            idb_drafts::Reply::Compared(false) if attempt < 2 => {
                slot = storage::read(host, id).await?;
            }
            _ => return Err("rejected"),
        }
    }
    Err("rejected")
}

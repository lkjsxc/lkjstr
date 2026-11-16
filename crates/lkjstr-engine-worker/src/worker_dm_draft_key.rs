//! A signer wraps the local random seed once; each account session unwraps lazily.
use super::*;
pub(super) async fn ensure(
    host: &Rc<RefCell<Host>>,
    id: u64,
    generation: &str,
    envelope: Option<&policy::Envelope>,
) -> Result<(), &'static str> {
    let (client, account, epoch, deadline) = {
        let h = host.borrow();
        check(&h, id)?;
        let job = h.dm.drafts.jobs.get(&id).ok_or("signer-missing")?;
        if let Some(envelope) = envelope
            && h.dm.drafts.keys.get(&job.account).is_some_and(|cached| {
                cached.epoch == job.epoch
                    && cached.generation == generation
                    && cached.wrapped_seed.as_deref() == Some(envelope.wrapped_seed.as_str())
            })
        {
            return Ok(());
        }
        (job.client, job.account.clone(), job.epoch, job.deadline)
    };
    host.borrow_mut().dm.drafts.keys.remove(&account);
    if let Some(envelope) = envelope {
        let decoded = SecretText::new(
            crypto::crypt(
                host,
                client,
                &account,
                &account,
                "nip44.decrypt",
                envelope.wrapped_seed.clone(),
                deadline,
            )
            .await?,
        );
        check(&host.borrow(), id)?;
        let key = policy::open_seed(&account, &decoded)?;
        let mut h = host.borrow_mut();
        check(&h, id)?;
        h.dm.drafts.keys.insert(
            account,
            Cached {
                epoch,
                generation: generation.into(),
                wrapped_seed: Some(envelope.wrapped_seed.clone()),
                key,
            },
        );
    } else {
        let data = {
            let prepared = policy::prepare_seed(&account, crypto::random()?)?;
            let data = prepared.payload.to_string();
            let mut h = host.borrow_mut();
            check(&h, id)?;
            h.dm.drafts.keys.insert(
                account.clone(),
                Cached {
                    epoch,
                    generation: generation.into(),
                    wrapped_seed: None,
                    key: prepared.key,
                },
            );
            data
        };
        let wrapped = crypto::crypt(
            host,
            client,
            &account,
            &account,
            "nip44.encrypt",
            data,
            deadline,
        )
        .await?;
        let mut h = host.borrow_mut();
        check(&h, id)?;
        if !(132..=4096).contains(&wrapped.len()) {
            h.dm.drafts.keys.remove(&account);
            return Err("rejected");
        }
        let cached = h.dm.drafts.keys.get_mut(&account).ok_or("signer-missing")?;
        cached.wrapped_seed = Some(wrapped);
    }
    Ok(())
}

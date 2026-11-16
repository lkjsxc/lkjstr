use super::*;
use lkjstr_core::engine::wire::{Input as I, actions::Action as A};
pub(in crate::worker) fn input(h: &mut Host, client: u64, input: &I) -> bool {
    if !h.sessions.contains_key(&client) {
        return false;
    }
    let submission = match input {
        I::ZapQuote { req, .. }
        | I::ZapReceipts { req, .. }
        | I::Act {
            req,
            action: A::ZapInvoice { .. },
        } => Some(req),
        _ => None,
    };
    // One owner has one terminal reply. A duplicate submission cannot fail the
    // caller while leaving its original signer/HTTP work alive in the background.
    if submission.is_some_and(|req| {
        h.engine.zaps.jobs.owns(&Owner {
            client,
            req: req.clone(),
        })
    }) {
        return true;
    }
    let at = h.time();
    match input {
        I::ZapQuote { req, query } => {
            let owner = Owner {
                client,
                req: req.clone(),
            };
            if let Err(error) = h.engine.zaps.jobs.quote(owner, query.clone(), at / 1000) {
                h.scope.direct(
                    client,
                    &W::ZapQuote {
                        req: req.clone(),
                        quote: policy::Quote {
                            target: query.target.clone(),
                            phase: error.phase(),
                            error: Some(error),
                            recipients: vec![],
                        },
                    },
                );
            }
        }
        I::ZapReceipts { req, query } => {
            let owner = Owner {
                client,
                req: req.clone(),
            };
            if let Err(error) = h.engine.zaps.jobs.receipts(owner, query.clone(), at / 1000) {
                h.scope.direct(
                    client,
                    &W::ZapReceipts {
                        req: req.clone(),
                        page: policy::ReceiptView {
                            target: query.target.clone(),
                            phase: error.phase(),
                            error: Some(error),
                            coverage: policy::Coverage::Failed,
                            page: None,
                        },
                    },
                );
            }
        }
        I::ZapClose { req } => h.engine.zaps.jobs.close(&Owner {
            client,
            req: req.clone(),
        }),
        I::Act {
            req,
            action: A::ZapInvoice { account, intent },
        } => {
            let result = h
                .accounts
                .require_signer(account)
                .map_err(|_| Failure::SignerMissing)
                .and_then(|_| {
                    let relays = h.engine.zap_receipt_relays(account, &intent.target);
                    h.engine.zaps.jobs.invoice(
                        Owner {
                            client,
                            req: req.clone(),
                        },
                        account.clone(),
                        intent.clone(),
                        relays,
                        at / 1000,
                    )
                });
            if let Err(error) = result {
                h.scope
                    .direct(client, &Session::failure(req.clone(), failure(error)));
            }
        }
        _ => return false,
    }
    h.engine.zap_refresh(at);
    true
}

use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{Account, SignerType};

use crate::workspace::accounts_provider::{AccountsProvider, AccountsResult};

pub fn account_row(
    account: Account,
    active_id: RwSignal<Option<String>>,
    revealed: RwSignal<BTreeMap<String, String>>,
    provider: AccountsProvider,
    accounts: RwSignal<Vec<Account>>,
    status: RwSignal<String>,
) -> impl IntoView {
    let row_id = account.id.clone();
    let select_id = row_id.clone();
    let remove_id = row_id.clone();
    let reveal_id = row_id.clone();
    let select_provider = provider.clone();
    let remove_provider = provider.clone();
    let reveal_provider = provider.clone();
    let select = move |_| {
        let provider = select_provider.clone();
        let account_id = select_id.clone();
        run_accounts_result(accounts, active_id, status, revealed, move |complete| {
            provider.activate(account_id, complete);
        });
    };
    let remove = move |_| {
        let provider = remove_provider.clone();
        let account_id = remove_id.clone();
        run_accounts_result(accounts, active_id, status, revealed, move |complete| {
            provider.remove(account_id, complete);
        });
    };
    let reveal_click = move |_| {
        let provider = reveal_provider.clone();
        let account_id = reveal_id.clone();
        run_accounts_result(accounts, active_id, status, revealed, move |complete| {
            provider.reveal(account_id, complete);
        });
    };
    view! {
        <article class="accounts-row">
            <label>
                <input
                    type="radio"
                    name="active-account"
                    prop:checked=move || active_id.get().as_deref() == Some(row_id.as_str())
                    on:change=select
                />
                <span>{account.label.clone()}</span>
            </label>
            <small>{signer_label(account.signer_type)}</small>
            <code>{account.npub.clone()}</code>
            {local_secret_view(account.clone(), revealed, Callback::new(reveal_click))}
            <button type="button" on:click=remove>"Disconnect"</button>
        </article>
    }
}

pub fn run_accounts_result(
    accounts: RwSignal<Vec<Account>>,
    active_id: RwSignal<Option<String>>,
    status: RwSignal<String>,
    revealed: RwSignal<BTreeMap<String, String>>,
    run: impl FnOnce(Callback<AccountsResult>) + 'static,
) {
    let complete = Callback::new(move |result: AccountsResult| {
        let _unused = accounts.try_set(result.accounts);
        let _unused = active_id.try_set(result.active_id);
        let _unused = status.try_set(result.status);
        if let Some((account_id, nsec)) = result.revealed_nsec {
            let _unused = revealed.try_update(|items| {
                items.insert(account_id, nsec);
            });
        }
    });
    run(complete);
}

fn local_secret_view(
    account: Account,
    revealed: RwSignal<BTreeMap<String, String>>,
    reveal_click: Callback<leptos::ev::MouseEvent>,
) -> AnyView {
    if account.signer_type != SignerType::Local {
        return ().into_any();
    }
    let account_id = account.id;
    view! {
        {move || match revealed.get().get(&account_id).cloned() {
            Some(nsec) => view! { <code class="secret-value">{nsec}</code> }.into_any(),
            None => view! {
                <button type="button" on:click=move |event| reveal_click.run(event)>"Reveal nsec"</button>
            }.into_any(),
        }}
    }
    .into_any()
}

fn signer_label(signer_type: SignerType) -> &'static str {
    match signer_type {
        SignerType::Readonly => "read-only",
        SignerType::Nip07 => "NIP-07",
        SignerType::Local => "local",
    }
}

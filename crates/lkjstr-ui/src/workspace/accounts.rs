use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{Account, generate_nsec};

use crate::workspace::accounts_provider::AccountsProvider;
use crate::workspace::accounts_row::{account_row, run_accounts_result};

#[component]
pub fn AccountsTab(provider: Option<AccountsProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(AccountsProvider::storage_unavailable);
    let accounts = RwSignal::new(Vec::<Account>::new());
    let active_id = RwSignal::new(None::<String>);
    let status = RwSignal::new(String::from("Loading accounts"));
    let revealed = RwSignal::new(BTreeMap::<String, String>::new());
    let input = RwSignal::new(String::new());

    run_accounts_result(accounts, active_id, status, revealed, {
        let provider = provider.clone();
        move |complete| provider.load(complete)
    });

    let add_current = {
        let provider = provider.clone();
        move || {
            let value = input.get_untracked();
            run_accounts_result(accounts, active_id, status, revealed, {
                let provider = provider.clone();
                move |complete| provider.add_input(value, complete)
            });
            input.set(String::new());
        }
    };
    let submit = move |event: leptos::ev::SubmitEvent| {
        event.prevent_default();
        add_current();
    };
    let fill_nsec = move |_| {
        input.set(generate_nsec());
        status.set("Generated nsec. Add it as a local account when ready.".to_owned());
    };
    let input_change = move |event| input.set(event_target_value(&event));
    let input_commit = move |event| input.set(event_target_value(&event));

    view! {
        <section class="accounts-tab lkjstr-accounts" aria-label="Accounts" data-scroll-owner="">
            <form class="accounts-toolbar" on:submit=submit>
                <input
                    aria-label="npub, hex pubkey, or nsec"
                    placeholder="npub, hex pubkey, or nsec"
                    prop:value=move || input.get()
                    on:input=input_change
                    on:change=input_commit
                />
                <button type="button" on:click=fill_nsec>"Generate nsec"</button>
                <button type="submit" disabled=move || input.get().trim().is_empty()>"Add"</button>
            </form>
            <p role="status">{move || status.get()}</p>
            <div class="accounts-list">
                {move || render_accounts(
                    accounts.get(),
                    active_id,
                    revealed,
                    provider.clone(),
                    accounts,
                    status,
                )}
            </div>
        </section>
    }
}

fn render_accounts(
    rows: Vec<Account>,
    active_id: RwSignal<Option<String>>,
    revealed: RwSignal<BTreeMap<String, String>>,
    provider: AccountsProvider,
    accounts: RwSignal<Vec<Account>>,
    status: RwSignal<String>,
) -> AnyView {
    if rows.is_empty() {
        return view! { <p>"No account records are stored."</p> }.into_any();
    }
    view! {
        <fieldset>
            <legend>"Active account"</legend>
            {rows.into_iter().map(|account| {
                account_row(
                    account,
                    active_id,
                    revealed,
                    provider.clone(),
                    accounts,
                    status,
                )
            }).collect_view()}
        </fieldset>
    }
    .into_any()
}

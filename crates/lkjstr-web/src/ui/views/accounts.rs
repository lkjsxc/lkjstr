//! Accounts: create a key on this device, import one, or use an extension.

use leptos::prelude::*;

use crate::host::nip07;
use crate::runtime::session::Signer;
use crate::ui::Ui;
use crate::ui::note_parts::{Avatar, name_of};
use crate::ui::text::short_npub;

#[component]
pub fn Accounts() -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let accounts = Memo::new(move |_| {
        app.session_rev.track();
        app.with(|rt| (rt.session.accounts.clone(), rt.session.active.clone()))
    });
    let input = RwSignal::new(String::new());
    let message = RwSignal::new(None::<(bool, String)>);
    let revealed = RwSignal::new(None::<(String, String)>);
    let report = move |result: Result<String, String>, done: &str| match result {
        Ok(pubkey) => {
            let _ = message.try_set(Some((true, format!("{done} {}", short_npub(&pubkey)))));
        }
        Err(error) => {
            let _ = message.try_set(Some((false, error)));
        }
    };
    let import = move |_| {
        let text = input.get_untracked();
        leptos::task::spawn_local(async move {
            let result = app.import_account(&text).await;
            if result.is_ok() {
                let _ = input.try_set(String::new());
            }
            report(result, "Signed in as");
        });
    };
    let extension = move |_| {
        leptos::task::spawn_local(async move {
            report(app.connect_extension().await, "Connected extension for");
        });
    };
    view! {
        <div class="page">
            <h2>{move || ui.tr("Accounts")}</h2>
            <ul class="accounts">
                <For each=move || accounts.get().0 key=|a| (a.pubkey.clone(), a.signer) let:account>
                    {
                        let pubkey = account.pubkey.clone();
                        let (key_switch, key_remove, key_reveal, key_name) = (pubkey.clone(), pubkey.clone(), pubkey.clone(), pubkey.clone());
                        let active = Memo::new(move |_| accounts.with(|(_, active)| active.as_ref() == Some(&key_switch)));
                        let kind = match account.signer {
                            Signer::Local => "key on this device",
                            Signer::Extension => "signer extension",
                            Signer::ReadOnly => "read only",
                        };
                        view! {
                            <li class:active=move || active.get()>
                                <Avatar pubkey=pubkey.clone() class="avatar small"/>
                                <div class="grow">
                                    <strong>{move || name_of(ui, &key_name)}</strong>
                                    <div class="small muted">{short_npub(&pubkey)} " · " {kind}</div>
                                </div>
                                {
                                    let key = pubkey.clone();
                                    move || (!active.get()).then(|| { let key = key.clone(); view! { <button on:click=move |_| { let key = key.clone(); leptos::task::spawn_local(async move { if let Err(e) = app.switch_account(&key).await { report(Err(e), ""); } }); }>{move || ui.tr("Use")}</button> } })
                                }
                                {(account.signer == Signer::Local).then(|| view! {
                                    <button title="Show the secret key so you can back it up" on:click=move |_| {
                                        revealed.set(app.reveal_nsec(&key_reveal).map(|nsec| (key_reveal.clone(), nsec)));
                                    }>{move || ui.tr("Back up key")}</button>
                                })}
                                <button class="danger" on:click=move |_| { let key = key_remove.clone(); leptos::task::spawn_local(async move { if let Err(e) = app.remove_account(&key).await { report(Err(e), ""); } }); }>{move || ui.tr("Remove")}</button>
                            </li>
                        }
                    }
                </For>
            </ul>
            {move || accounts.with(|(list, _)| list.is_empty()).then(|| view! { <p class="muted">"No account yet. Create a key, import one, or use a signer extension. You can browse without one."</p> })}
            {move || revealed.get().map(|(_, nsec)| view! {
                <div class="secret" role="alert">
                    <p><strong>"Your secret key."</strong> " Anyone who sees it controls this account. Store it in a password manager, then hide it."</p>
                    <code>{nsec}</code>
                    <button on:click=move |_| revealed.set(None)>{move || ui.tr("Hide")}</button>
                </div>
            })}
            <h3>{move || ui.tr("Add an account")}</h3>
            <div class="row-actions">
                <button on:click=move |_| { leptos::task::spawn_local(async move { report(app.generate_account().await, "Created a new key for"); }); }>{move || ui.tr("Create a new key")}</button>
                <button disabled=move || !nip07::available() on:click=extension title="Uses window.nostr (NIP-07)">{move || ui.tr("Use signer extension")}</button>
            </div>
            <form class="search-bar" on:submit=move |ev| { ev.prevent_default(); import(()); }>
                <input type="password" autocomplete="off" placeholder="nsec1… to sign, or npub1… to read only" aria-label="Key to import"
                    prop:value=move || input.get() on:input=move |ev| input.set(event_target_value(&ev))/>
                <button type="submit">{move || ui.tr("Import")}</button>
            </form>
            {move || message.get().map(|(ok, text)| view! { <p class:error=!ok role="status">{text}</p> })}
            <p class="small muted">"Keys created or imported here are stored unencrypted in this browser's storage for this site. A signer extension keeps the key out of the page."</p>
        </div>
    }
}

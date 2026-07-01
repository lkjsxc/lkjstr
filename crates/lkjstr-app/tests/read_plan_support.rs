pub fn selected() -> lkjstr_app::read_availability::EffectiveReadRelays {
    lkjstr_app::read_availability::EffectiveReadRelays::from_durable_settings(vec![
        "wss://selected.example".to_owned(),
    ])
}

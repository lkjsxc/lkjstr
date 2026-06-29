pub fn enabled() -> bool {
    enabled_value(std::env::var("LKJSTR_RUN_E2E").ok().as_deref())
}

fn enabled_value(value: Option<&str>) -> bool {
    value == Some("1")
}

#[cfg(test)]
mod tests {
    use super::enabled_value;

    #[test]
    fn disables_e2e_by_default() {
        assert!(!enabled_value(None));
        assert!(!enabled_value(Some("0")));
        assert!(!enabled_value(Some("true")));
    }

    #[test]
    fn enables_e2e_only_with_explicit_one() {
        assert!(enabled_value(Some("1")));
    }
}

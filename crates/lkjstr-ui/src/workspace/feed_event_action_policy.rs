use leptos::ev::MouseEvent;

const fn action_click_stops_propagation() -> bool {
    true
}

pub(super) fn stop_action_click(event: MouseEvent) {
    if action_click_stops_propagation() {
        event.stop_propagation();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_button_clicks_stop_parent_row_activation() {
        assert!(action_click_stops_propagation());
    }
}

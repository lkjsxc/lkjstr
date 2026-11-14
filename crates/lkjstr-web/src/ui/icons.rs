//! One inline SVG family. Controls supply their accessible name and tooltip.
use leptos::prelude::*;

#[component]
pub fn Icon(name: &'static str) -> impl IntoView {
    let path = match name {
        "list" => "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
        "globe" => "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
        "settings" => {
            "M12 3v3M12 18v3M3 12h3M18 12h3M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0"
        }
        "image" => "M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M16 7h.01",
        "home" => "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
        "search" => "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
        "compose" => "m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5",
        "notifications" => "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
        "reply" => "m9 10-5 4 5 4M4 14h10a6 6 0 0 0 0-12",
        "repost" => "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3",
        "react" => {
            "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
        }
        "zap" => "m13 2-9 12h7l-1 8 10-12h-8Z",
        "user" => "M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
        "plus" => "M12 5v14M5 12h14",
        "close" => "m6 6 12 12M6 18 18 6",
        "more" => "M4 12h.01M12 12h.01M20 12h.01",
        _ => "M12 3v18M3 12h18",
    };
    view! {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d=path/>
        </svg>
    }
}

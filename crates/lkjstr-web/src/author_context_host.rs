pub fn author_context_feed_provider() -> lkjstr_ui::AuthorContextFeedProvider {
    lkjstr_ui::AuthorContextFeedProvider::new(|request| {
        request.complete(lkjstr_app::default_author_context_feed_view(
            &request.owner,
            request.event_id.clone(),
            request.author_pubkey.clone(),
        ));
    })
}

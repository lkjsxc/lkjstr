use super::*;
async fn fake() -> (fetch::Network, tokio::task::JoinHandle<()>) {
    let router = Router::new().route("/", get(|| async { axum::response::Html("<meta property='og:title' content='Local news'>") }))
        .route("/redirect", get(|| async { (StatusCode::FOUND, [("location", "/")]) }))
        .route("/private", get(|| async { (StatusCode::FOUND, [("location", "http://127.0.0.1/")]) }))
        .route("/loop", get(|| async { (StatusCode::FOUND, [("location", "/loop")]) }))
        .route("/large", get(|| async { axum::response::Html("x".repeat(fetch::MAX + 1)) }))
        .route("/slow", get(|| async { tokio::time::sleep(std::time::Duration::from_secs(7)).await; axum::response::Html("late") }))
        .route("/embed", get(|| async { axum::response::Html("<link rel='alternate' type='application/json+oembed' href='/json'><title>Fallback</title>") }))
        .route("/r1", get(|| async { (StatusCode::FOUND, [("location", "/r2")]) }))
        .route("/r2", get(|| async { (StatusCode::FOUND, [("location", "/r3")]) }))
        .route("/r3", get(|| async { (StatusCode::FOUND, [("location", "/discovery")]) }))
        .route("/discovery", get(|| async { axum::response::Html("<link rel='alternate' type='application/json+oembed' href='/redirect-json'><title>Fallback</title>") }))
        .route("/redirect-json", get(|| async { (StatusCode::FOUND, [("location", "/json")]) }))
        .route("/json", get(|| async { Json(serde_json::json!({"title":"oEmbed title","provider_name":"Local"})) }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .unwrap_or_else(|_| unreachable!());
    let endpoint = listener.local_addr().ok();
    let task = tokio::spawn(async move {
        let _ = axum::serve(listener, router).await;
    });
    (fetch::Network { endpoint }, task)
}
#[tokio::test]
async fn fake_sites_redirect_budget_and_discovery() {
    let (network, task) = fake().await;
    for (path, title) in [
        ("/", "Local news"),
        ("/redirect", "Local news"),
        ("/embed", "oEmbed title"),
        ("/r1", "Fallback"),
    ] {
        let u = security::target(&format!("http://public.test{path}"))
            .unwrap_or_else(|_| unreachable!());
        assert_eq!(
            network.preview(&u).await.ok().map(|v| v.title).as_deref(),
            Some(title)
        );
    }
    for path in ["/private", "/loop", "/large", "/slow"] {
        let u = security::target(&format!("http://public.test{path}"))
            .unwrap_or_else(|_| unreachable!());
        assert!(network.preview(&u).await.is_err());
    }
    task.abort();
}

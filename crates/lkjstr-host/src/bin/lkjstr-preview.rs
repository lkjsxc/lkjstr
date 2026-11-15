//! Run separately from the static site. All diagnostics are address-free constants.
use std::{net::SocketAddr, path::PathBuf};
#[tokio::main(worker_threads = 4)]
async fn main() {
    if run().await.is_err() {
        eprintln!("preview service failed");
        std::process::exit(1);
    }
}
async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let bind: SocketAddr = std::env::var("LKJSTR_PREVIEW_BIND")
        .unwrap_or_else(|_| "127.0.0.1:18880".into())
        .parse()?;
    if !bind.ip().is_loopback() {
        return Err("loopback bind required".into());
    }
    let root = PathBuf::from(std::env::var("LKJSTR_PREVIEW_CACHE")?);
    let origin = std::env::var("LKJSTR_PREVIEW_ORIGIN")
        .unwrap_or_else(|_| "https://lkjstr.lkjsxc.com".into());
    let app = lkjstr_host::preview::app(root, origin)?;
    let listener = tokio::net::TcpListener::bind(bind).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}

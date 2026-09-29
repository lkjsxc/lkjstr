use std::{
    error::Error,
    io::{self, Read, Write},
    net::{SocketAddr, TcpStream},
    path::Path,
    time::Duration,
};

type Result<T> = std::result::Result<T, Box<dyn Error>>;

#[tokio::main(worker_threads = 2)]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.as_slice() {
        [command, root] if command == "check" => {
            lkjstr_host::validate_root(Path::new(root))?;
            println!("ok lkjstr-host assets");
        }
        [command, address] if command == "probe" => probe(address.parse()?)?,
        [command, root, address] if command == "serve" => {
            let app = lkjstr_host::app(Path::new(root))?;
            let address: SocketAddr = address.parse()?;
            let listener = tokio::net::TcpListener::bind(address).await?;
            println!("lkjstr-host listening on {}", listener.local_addr()?);
            axum::serve(listener, app)
                .with_graceful_shutdown(shutdown())
                .await?;
        }
        [help] if help == "--help" || help == "-h" => println!("{}", usage()),
        _ => return Err(io::Error::new(io::ErrorKind::InvalidInput, usage()).into()),
    }
    Ok(())
}

fn usage() -> &'static str {
    "usage: lkjstr-host check ASSET_DIR | serve ASSET_DIR IP:PORT | probe IP:PORT"
}

fn probe(address: SocketAddr) -> Result<()> {
    let timeout = Duration::from_secs(3);
    let mut stream = TcpStream::connect_timeout(&address, timeout)?;
    stream.set_read_timeout(Some(timeout))?;
    stream.set_write_timeout(Some(timeout))?;
    stream.write_all(b"GET /healthz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")?;
    let mut response = String::new();
    stream.take(4097).read_to_string(&mut response)?;
    if response.len() > 4096
        || !response.starts_with("HTTP/1.1 200 ")
        || !response.ends_with("\r\n\r\nok lkjstr-host\n")
    {
        return Err(io::Error::other("lkjstr-host readiness probe failed").into());
    }
    println!("ok lkjstr-host readiness");
    Ok(())
}

async fn shutdown() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        match signal(SignalKind::terminate()) {
            Ok(mut terminate) => {
                tokio::select! {
                    _ = tokio::signal::ctrl_c() => {},
                    _ = terminate.recv() => {},
                }
            }
            Err(error) => eprintln!("cannot install termination handler: {error}"),
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

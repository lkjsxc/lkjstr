//! Public signed rows for a physical IndexedDB cold-start benchmark. No keys output.
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use std::io::{self, Write};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let count = std::env::args()
        .nth(1)
        .map(|value| value.parse::<u64>())
        .transpose()?
        .unwrap_or(100000);
    let key = generate_secret_key();
    let mut output = io::BufWriter::new(io::stdout().lock());
    write!(output, "[")?;
    for i in 0..count {
        let event = finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: 1700000000 + i,
                kind: 1,
                tags: vec![],
                content: format!("cold-start-{i}"),
            },
            &key,
        )
        .map_err(|_| "signing failed")?;
        if i > 0 {
            write!(output, ",")?;
        }
        serde_json::to_writer(
            &mut output,
            &serde_json::json!({"id":event.id,"created_at":event.created_at,"raw":lkjstr_protocol::compact::encode(&event)?}),
        )?;
    }
    writeln!(output, "]")?;
    Ok(())
}

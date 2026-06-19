use std::{
    io::Read,
    process::{Command, ExitStatus, Stdio},
    thread,
    time::{Duration, Instant},
};

const POLL_INTERVAL: Duration = Duration::from_millis(250);

pub struct QuietOutput {
    pub status: Option<ExitStatus>,
    pub timed_out: bool,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

pub fn run_with_timeout(command: &mut Command, timeout: Duration) -> Result<QuietOutput, String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to spawn command: {error}"))?;
    let stdout = child.stdout.take().map(read_stream);
    let stderr = child.stderr.take().map(read_stream);
    let started = Instant::now();

    let mut status = None;
    let mut timed_out = false;
    loop {
        if let Some(done) = child
            .try_wait()
            .map_err(|error| format!("failed to poll command: {error}"))?
        {
            status = Some(done);
            break;
        }
        if started.elapsed() >= timeout {
            timed_out = true;
            let _ = child.kill();
            let _ = child.wait().map(|done| status = Some(done));
            break;
        }
        thread::sleep(POLL_INTERVAL);
    }

    Ok(QuietOutput {
        status,
        timed_out,
        stdout: join_stream(stdout),
        stderr: join_stream(stderr),
    })
}

fn read_stream<R>(mut stream: R) -> thread::JoinHandle<Vec<u8>>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut output = Vec::new();
        let _ = stream.read_to_end(&mut output);
        output
    })
}

fn join_stream(stream: Option<thread::JoinHandle<Vec<u8>>>) -> Vec<u8> {
    stream
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use std::{process::Command, time::Duration};

    use super::run_with_timeout;

    #[test]
    fn captures_success_output() -> Result<(), String> {
        let mut command = Command::new("sh");
        command.args(["-c", "printf ok"]);
        let output = run_with_timeout(&mut command, Duration::from_secs(1))?;
        assert!(!output.timed_out);
        assert!(output.status.is_some_and(|status| status.success()));
        assert_eq!(output.stdout, b"ok");
        Ok(())
    }

    #[test]
    fn reports_timed_out_child() -> Result<(), String> {
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 2"]);
        let output = run_with_timeout(&mut command, Duration::from_millis(50))?;
        assert!(output.timed_out);
        assert!(!output.status.is_some_and(|status| status.success()));
        Ok(())
    }
}

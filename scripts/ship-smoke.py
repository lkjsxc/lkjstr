"""Run and settle one Linux smoke attempt before publishing its status."""

import ctypes
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


PR_SET_CHILD_SUBREAPER = 36
KILL_WAIT = 5


def reap_children():
    """Return whether any owned children still exist after reaping exits."""
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return False
        if pid == 0:
            return True


def drain(children, grace):
    force_at = time.monotonic() + grace
    while reap_children():
        now = time.monotonic()
        if now >= force_at + KILL_WAIT:
            raise RuntimeError("owned smoke processes remain after SIGKILL")
        if now >= force_at:
            # Kill only direct children. Their detached descendants reparent
            # here as they die. No other thread can reap and release these PIDs.
            for pid in children.read_text().split():
                try:
                    os.kill(int(pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
        time.sleep(0.05)


def run(attempt, deadline, grace, args):
    # An inherited SIG_IGN auto-reaps children and hides their exit status.
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    # Playwright starts Chromium in another session. Adopt orphans from this
    # attempt even when they leave the command's initial process group.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0):
        raise OSError(ctypes.get_errno(), "cannot become a child subreaper")
    children = Path(f"/proc/self/task/{os.getpid()}/children")
    children.read_text()
    with (attempt / "stdout").open("wb") as stdout, (attempt / "stderr").open("wb") as stderr:
        command = subprocess.Popen(args, start_new_session=True, stdout=stdout, stderr=stderr)
        try:
            status = command.wait(timeout=deadline)
        except subprocess.TimeoutExpired:
            try:
                # The leader has not been reaped, so its group ID cannot be reused.
                os.killpg(command.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            status = 124
        drain(children, grace)
    return status if status >= 0 else 128 - status


attempt, deadline, grace, *args = sys.argv[1:]
print(run(Path(attempt), float(deadline), float(grace), args))

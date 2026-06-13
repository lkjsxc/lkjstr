#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RelayTimerKind {
    ConnectDeadline,
    Reconnect,
    ReadDeadline,
    IdleEviction,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RelayClientDiagnosticKind {
    QueueFull,
    SocketError,
    SocketClosed,
    ConnectTimeout,
    IgnoredAfterClose,
    RelayClosed,
    RelayNotice,
    RelayAuth,
    RelayOkRejected,
    MalformedMessage,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelayClientEffect {
    OpenSocket,
    CloseSocket,
    SendFrame(String),
    InboundFrame(String),
    RelayEvent {
        subscription_id: String,
        event_id: String,
    },
    ScheduleTimer {
        kind: RelayTimerKind,
        delay_ms: u32,
    },
    ClearTimer {
        kind: RelayTimerKind,
    },
    FetchNip11,
    RecordDiagnostic {
        kind: RelayClientDiagnosticKind,
        detail: String,
    },
    PublishSnapshot,
    DropCallbackOwner,
}

pub const fn connect_deadline_ms() -> u32 {
    10_000
}

pub const fn reconnect_base_delay_ms() -> u32 {
    500
}

pub const fn reconnect_max_delay_ms() -> u32 {
    15_000
}

pub(super) fn clear_timer(kind: RelayTimerKind) -> RelayClientEffect {
    RelayClientEffect::ClearTimer { kind }
}

pub(super) fn diagnostic(
    kind: RelayClientDiagnosticKind,
    detail: impl Into<String>,
) -> RelayClientEffect {
    RelayClientEffect::RecordDiagnostic {
        kind,
        detail: detail.into(),
    }
}

pub(super) fn schedule_timer(kind: RelayTimerKind, delay_ms: u32) -> RelayClientEffect {
    RelayClientEffect::ScheduleTimer { kind, delay_ms }
}

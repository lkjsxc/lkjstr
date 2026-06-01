#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelayClientEvent {
    ConnectRequested,
    SocketOpened,
    SocketMessage { frame: String },
    SocketError { reason: String },
    SocketClosed { reason: String },
    SendRequested { frame: String },
    ReconnectTimerElapsed,
    ConnectDeadlineElapsed,
    CloseRequested { reason: String },
    OwnerClosed,
}

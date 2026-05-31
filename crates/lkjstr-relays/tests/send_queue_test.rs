use lkjstr_relays::{RelaySendQueue, max_relay_queued_messages};

#[test]
fn send_queue_accepts_until_capacity_and_drains_fifo() {
    let mut queue = RelaySendQueue::default();

    for index in 0..max_relay_queued_messages() {
        assert!(queue.enqueue(format!("message-{index}")));
    }
    assert!(!queue.enqueue("overflow"));
    assert!(queue.has_pending());

    let drained = queue.drain();
    assert_eq!(drained.first().map(String::as_str), Some("message-0"));
    assert_eq!(drained.last().map(String::as_str), Some("message-63"));
    assert!(queue.is_empty());
}

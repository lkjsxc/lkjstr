#![allow(clippy::expect_used)]
use super::{Pool, Value, ValueRef};
use std::sync::Arc;
#[test]
fn borrowed_lookup_checks_values_when_different_symbols_share_a_bucket() {
    let mut pool = Pool::default();
    let target = "wss://wanted.invalid/";
    let (hash, existing) = pool.lookup(ValueRef::Text(target));
    assert!(existing.is_none());
    // Inject a hash collision through the normal allocation/accounting path.
    let collision = pool.intern_new(hash, Value::Text("wss://other.invalid/".into()));
    let wanted = pool.text(target);
    assert_eq!(wanted.as_str(), Some(target));
    assert!(!Arc::ptr_eq(&wanted, &collision));
    assert!(Arc::ptr_eq(&wanted, &pool.text(target)));
    let key = [0x22; 32];
    let (hash, _) = pool.lookup(ValueRef::Key(&key));
    let collision = pool.intern_new(hash, Value::Text("2".repeat(64).into_boxed_str()));
    let wanted = pool.key(key);
    assert_eq!(wanted.key(), Some(&key));
    assert!(!Arc::ptr_eq(&wanted, &collision));
    assert!(Arc::ptr_eq(&wanted, &pool.key(key)));
}

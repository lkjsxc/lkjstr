//! Redacted owned text, used for passwords and legacy stored local keys.
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use zeroize::Zeroizing;

#[derive(Clone)]
pub struct SecretText(Zeroizing<String>);
impl SecretText {
    pub fn new(value: String) -> Self {
        Self(Zeroizing::new(value))
    }
}
impl core::ops::Deref for SecretText {
    type Target = str;
    fn deref(&self) -> &str {
        self.0.as_str()
    }
}
impl core::fmt::Debug for SecretText {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("SecretText([REDACTED])")
    }
}
impl Serialize for SecretText {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.0)
    }
}
impl<'de> Deserialize<'de> for SecretText {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        String::deserialize(d).map(Self::new)
    }
}

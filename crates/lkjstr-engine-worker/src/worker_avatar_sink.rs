//! Clone the actual Blob in a client-targeted envelope; it is never JSON or a transfer-list entry.
use super::*;
impl Sink {
    pub(in crate::worker) fn avatar(
        &self,
        id: u64,
        envelope: &avatars::Envelope<'_>,
        blob: Option<&web_sys::Blob>,
    ) -> bool {
        let target = match self {
            Self::Dedicated(scope) if id == 0 => scope.as_ref(),
            Self::Shared { peers, .. } => match peers.get(&id) {
                Some(peer) => peer.port.as_ref(),
                None => return false,
            },
            _ => return false,
        };
        let Ok(value) = envelope.serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        else {
            return false;
        };
        if let Some(blob) = blob
            && js_sys::Reflect::set(&value, &"blob".into(), blob.as_ref()).ok() != Some(true)
        {
            return false;
        }
        js_sys::Reflect::get(target, &"postMessage".into())
            .ok()
            .and_then(|post| post.dyn_into::<js_sys::Function>().ok())
            .is_some_and(|post| post.call1(target, &value).is_ok())
    }
}

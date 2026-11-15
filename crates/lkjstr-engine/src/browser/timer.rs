//! Worker-safe timeout with an explicit cancellation path.
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
pub struct Timer {
    id: JsValue,
    _callback: Closure<dyn FnMut()>,
}
impl Timer {
    pub fn after(ms: u32, callback: impl FnMut() + 'static) -> Result<Self, JsValue> {
        let callback = Closure::new(callback);
        let global = js_sys::global();
        let set: js_sys::Function =
            js_sys::Reflect::get(&global, &"setTimeout".into())?.dyn_into()?;
        let id = set.call2(&global, callback.as_ref(), &ms.into())?;
        Ok(Self {
            id,
            _callback: callback,
        })
    }
}
impl Drop for Timer {
    fn drop(&mut self) {
        let global = js_sys::global();
        if let Ok(clear) = js_sys::Reflect::get(&global, &"clearTimeout".into())
            && let Some(clear) = clear.dyn_ref::<js_sys::Function>()
        {
            let _ = clear.call1(&global, &self.id);
        }
    }
}

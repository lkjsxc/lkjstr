use js_sys::{Function, Promise, Reflect};
use lkjstr_ui::{ProfileCopyProvider, ProfileCopyResult};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;

pub(crate) fn profile_copy_provider() -> ProfileCopyProvider {
    ProfileCopyProvider::new(|command| {
        wasm_bindgen_futures::spawn_local(async move {
            let label = command.label.clone();
            let result = match write_text(command.value).await {
                Ok(()) => ProfileCopyResult::copied(label),
                Err(error) => ProfileCopyResult::failed(label, js_message(error)),
            };
            command.complete.complete(result);
        });
    })
}

async fn write_text(value: String) -> Result<(), JsValue> {
    let promise = write_text_promise(value)?;
    JsFuture::from(promise).await.map(|_| ())
}

fn write_text_promise(value: String) -> Result<Promise, JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("missing window"))?;
    let navigator = Reflect::get(window.as_ref(), &JsValue::from_str("navigator"))?;
    let clipboard = Reflect::get(&navigator, &JsValue::from_str("clipboard"))?;
    if clipboard.is_null() || clipboard.is_undefined() {
        return Err(JsValue::from_str("clipboard API unavailable"));
    }
    let write_text = Reflect::get(&clipboard, &JsValue::from_str("writeText"))?;
    let write_text = write_text.dyn_into::<Function>()?;
    write_text
        .call1(&clipboard, &JsValue::from_str(&value))?
        .dyn_into::<Promise>()
}

fn js_message(value: JsValue) -> String {
    value.as_string().unwrap_or_else(|| {
        Reflect::get(&value, &JsValue::from_str("message"))
            .ok()
            .and_then(|message| message.as_string())
            .unwrap_or_else(|| "clipboard write failed".to_owned())
    })
}

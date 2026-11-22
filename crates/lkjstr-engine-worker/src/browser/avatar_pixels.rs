//! One uncancellable decode/encode chain. The caller keeps its permit until this future settles.
use lkjstr_core::engine::avatars::{MAX_DERIVED_BYTES, jobs::Failure, pixels};
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    AbortSignal, Blob, ImageBitmap, ImageEncodeOptions, OffscreenCanvas,
    OffscreenCanvasRenderingContext2d, WorkerGlobalScope,
};
#[derive(Clone)]
pub struct Picture {
    pub blob: Blob,
    pub edge: u32,
    pub source_width: u32,
    pub source_height: u32,
}
struct Bitmap(ImageBitmap);
impl Drop for Bitmap {
    fn drop(&mut self) {
        self.0.close();
    }
}
fn active(signal: &AbortSignal) -> Result<(), Failure> {
    (!signal.aborted()).then_some(()).ok_or(Failure::Transient)
}
async fn encode(canvas: &OffscreenCanvas, mime: &str) -> Result<Blob, Failure> {
    let options = ImageEncodeOptions::new();
    options.set_type(mime);
    options.set_quality(0.8);
    let promise = canvas
        .convert_to_blob_with_options(&options)
        .map_err(|_| Failure::Capability)?;
    JsFuture::from(promise)
        .await
        .map_err(|_| Failure::Capability)?
        .dyn_into()
        .map_err(|_| Failure::Capability)
}
pub async fn derive(raw: Blob, signal: &AbortSignal) -> Result<Picture, Failure> {
    active(signal)?;
    let worker: WorkerGlobalScope = js_sys::global()
        .dyn_into()
        .map_err(|_| Failure::Capability)?;
    let promise = worker
        .create_image_bitmap_with_blob(&raw)
        .map_err(|_| Failure::Capability)?;
    let bitmap = Bitmap(
        JsFuture::from(promise)
            .await
            .map_err(|_| Failure::Unsupported { uniform: false })?
            .dyn_into::<ImageBitmap>()
            .map_err(|_| Failure::Capability)?,
    );
    drop(raw);
    active(signal)?;
    let (width, height) = (bitmap.0.width(), bitmap.0.height());
    let edge = pixels::edge(width, height).ok_or(Failure::Unsupported { uniform: false })?;
    let canvas = OffscreenCanvas::new(edge, edge).map_err(|_| Failure::Capability)?;
    let context: OffscreenCanvasRenderingContext2d = canvas
        .get_context("2d")
        .map_err(|_| Failure::Capability)?
        .ok_or(Failure::Capability)?
        .dyn_into()
        .map_err(|_| Failure::Capability)?;
    context.set_image_smoothing_enabled(true);
    js_sys::Reflect::set(
        context.as_ref(),
        &"imageSmoothingQuality".into(),
        &"high".into(),
    )
    .map_err(|_| Failure::Capability)?;
    let side = f64::from(width.min(height));
    context
        .draw_image_with_image_bitmap_and_sw_and_sh_and_dx_and_dy_and_dw_and_dh(
            &bitmap.0,
            (f64::from(width) - side) / 2.0,
            (f64::from(height) - side) / 2.0,
            side,
            side,
            0.0,
            0.0,
            f64::from(edge),
            f64::from(edge),
        )
        .map_err(|_| Failure::Capability)?;
    drop(bitmap);
    let data = context
        .get_image_data(0.0, 0.0, f64::from(edge), f64::from(edge))
        .map_err(|_| Failure::Capability)?
        .data();
    let pixels = pixels::classify(&data.0).ok_or(Failure::Capability)?;
    if pixels.uniform {
        return Err(Failure::Unsupported { uniform: true });
    }
    active(signal)?;
    let mut blob = encode(&canvas, "image/webp").await?;
    active(signal)?;
    if blob.type_() != "image/webp" {
        blob = encode(
            &canvas,
            if pixels.opaque {
                "image/jpeg"
            } else {
                "image/png"
            },
        )
        .await?;
        active(signal)?;
        let actual = blob.type_();
        if actual != "image/png" && !(pixels.opaque && actual == "image/jpeg") {
            return Err(Failure::Capability);
        }
    }
    if !(1.0..=MAX_DERIVED_BYTES as f64).contains(&blob.size()) {
        return Err(Failure::Unsupported { uniform: false });
    }
    Ok(Picture {
        blob,
        edge,
        source_width: width,
        source_height: height,
    })
}
pub fn valid(picture: &Picture) -> bool {
    (1..=lkjstr_core::engine::avatars::EDGE).contains(&picture.edge)
        && picture.source_width >= picture.edge
        && picture.source_height >= picture.edge
        && (1.0..=MAX_DERIVED_BYTES as f64).contains(&picture.blob.size())
        && matches!(
            picture.blob.type_().as_str(),
            "image/webp" | "image/jpeg" | "image/png"
        )
}

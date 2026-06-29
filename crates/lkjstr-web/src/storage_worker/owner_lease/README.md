# Storage Worker Owner Lease

This submodule holds the wasm32 Web Locks reflection code for the SQLite OPFS
owner lease. It avoids `wasm_bindgen(inline_js)` so production storage ownership
cannot depend on untracked snippet assets.

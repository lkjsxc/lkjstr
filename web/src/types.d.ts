/** Build-time values (esbuild define). */
declare const __VERSION__: string;
declare const __COMMIT__: string;
/** Address of the real Transport adapter, or the mock worker in a mock build. */
declare const __ENGINE_URL__: string;
/** Address of the picker's Unicode emoji table ('' in tests). */
declare const __EMOJI_URL__: string;

/** Select the package adapter instead of the dedicated mock worker. */
declare const __REAL_ENGINE__: boolean;

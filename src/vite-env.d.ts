/** Типы для офлайн-сборки (Vite). */

declare module "*.wasm?url" {
  const src: string;
  export default src;
}

declare const __APP_PASSPHRASE__: string;
declare const __BUILD_MODE__: string;

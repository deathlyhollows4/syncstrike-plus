// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig as defineTanstackConfig } from "@lovable.dev/vite-tanstack-config";
import { defineConfig as defineViteConfig } from "vite";

// When running tests (Vitest), avoid initializing the full TanStack Start
// plugin surface which expects a running dev server. Vitest sets `process.env.VITEST`.
const isVitest = typeof process !== 'undefined' && !!process.env.VITEST;

export default (isVitest ? defineViteConfig({}) : defineTanstackConfig());

import { resolve } from "path"
import { defineConfig } from "vite"

export default defineConfig({
    base: "./",

    build: {
        target: "esnext",
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                "service-worker": resolve(__dirname, "service-worker.js"),
                "P2PSetup": resolve(__dirname, "p2p/P2PSetup.html"),
            },
            output: {
                entryFileNames: `[name].js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`,
            },
        },
        minify: false,
    },
    optimizeDeps: {
        esbuildOptions: { target: "esnext" },
    },
    plugins: [],
    define: { "process.env": {} },
})

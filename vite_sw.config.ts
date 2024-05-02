import { resolve } from "path"
import { defineConfig } from "vite"
import { replaceCodePlugin } from "vite-plugin-replace";

export default defineConfig({
    base: "./",

    build: {
        target: "esnext",
        emptyOutDir: false,
        sourcemap: true,
        rollupOptions: {
            input: {
                "service-worker": resolve(__dirname, "service-worker.js"),
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
    plugins: [
    replaceCodePlugin({
      replacements: [
	{ 
	    from: "import url from \"./automerge_wasm_bg.wasm?url\";",
	    to: "const url = location.origin+'/automerge_wasm_bg.wasm';"
	},
        {
          from: "import.meta.url",
          to: "location.origin",
        },
      ],
    }),
    ],
    define: { "process.env": {} },
})

import { resolve } from "path";
import { defineConfig } from "vite";
import { replaceCodePlugin } from "vite-plugin-replace";


export default defineConfig({
    base: "./",

    build: {
        target: "esnext",
        sourcemap: true,
        rollupOptions: {
            input: {
                "main": resolve(__dirname, "index.html"),
                "P2PSetup": resolve(__dirname, "p2p/P2PSetup.html"),
            },
            output: {
                entryFileNames: `[name].js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`,
            },
        },
        minify: false
    },
    optimizeDeps: {
        esbuildOptions: { target: "esnext" },
    },
    plugins: [
    replaceCodePlugin({
      replacements: [
        { /** Fix for @onsetsoftware/automerge-patcher (or anyone really) importing the fullfat automerge stack when it shouldn't **/
          from: "from \"@automerge/automerge\";",
          to: "from \"@automerge/automerge/slim\";",
        },
        { /** Fix for @onsetsoftware/automerge-patcher (or anyone really) importing the fullfat automerge stack when it shouldn't **/
          from: "from \"@automerge/automerge-repo\";",
          to: "from \"@automerge/automerge-repo/slim\";",
        },
      ],
    }),
    ],

    define: { "process.env": {} },
})

const path = require('path');

module.exports = {
    root: path.resolve(__dirname, 'src/app'),
    base: './',
    define: {
        // Legacy Node-oriented deps (jszip's stream polyfill, intl, sql.js)
        // reference the Node `global` object, which doesn't exist in browsers.
        global: 'globalThis',
    },
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: path.resolve(__dirname, 'src/app/index.html'),
                home: path.resolve(__dirname, 'src/app/home.html'),
                editor: path.resolve(__dirname, 'src/app/editor.html'),
                gettingstarted: path.resolve(__dirname, 'src/app/gettingstarted.html'),
            },
        },
    },
};

const { resolve } = require('path');
const { build } = require('vite');

async function main() {
  await build({
    outDir: './dist',
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        }
      }
    }
  });

  console.log('SDK works in Vite build ✅');
}

main();

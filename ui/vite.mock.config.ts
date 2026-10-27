import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * The page opened from disk: a browser refuses module scripts and fonts fetched from `file://`,
 * so the script and the styles go into the one HTML file.
 */
function inlineIntoHtml(): Plugin {
  return {
    name: 'inline-into-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((file) => file.fileName.endsWith('.html'));
      if (html?.type !== 'asset') return;
      const sourceOf = (path: string) => {
        const file = bundle[path.replace(/^\.?\//, '')];
        delete bundle[path.replace(/^\.?\//, '')];
        return String(file?.type === 'chunk' ? file.code : file?.source);
      };
      html.source = String(html.source)
        .replace(
          /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
          (_tag, href: string) => `<style>${sourceOf(href)}</style>`,
        )
        .replace(
          /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
          (_tag, src: string) =>
            `<script type="module">${sourceOf(src).replaceAll('</script', '<\\/script')}</script>`,
        );
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineIntoHtml()],
  base: './',
  build: {
    // The fonts go into the one file too: a browser refuses them from `file://`.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    outDir: 'dist/mock',
    rolldownOptions: { input: 'mock.html', output: { codeSplitting: false } },
  },
});

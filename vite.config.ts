import { defineConfig, loadEnv } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Tauri bundles dist/ at its own root. The web deployment lives under /videos/.
  const isTauriBuild = Boolean(
    process.env.TAURI_ENV_PLATFORM
    || process.env.TAURI_ENV_TARGET_TRIPLE
    || process.env.TAURI_ENV_ARCH
  );
  const base = mode === 'production' ? (isTauriBuild ? './' : '/videos/') : '/';
  return {
    base,
    plugins: [
      react(),
      {
        name: 'oss-upload-proxy',
        configureServer(server: ViteDevServer) {
          server.middlewares.use('/api/upload', (req: IncomingMessage, res: ServerResponse) => {
            if (req.method === 'POST') {
              const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
              const fileName = urlObj.searchParams.get('name') || 'audio.mp3';

              const chunks: Buffer[] = [];
              req.on('data', (chunk: Buffer) => chunks.push(chunk));
              req.on('end', async () => {
                try {
                  const buffer = Buffer.concat(chunks);
                  const { default: OSS } = await import('ali-oss');
                  const client = new OSS({
                    region: env.OSS_REGION || 'oss-cn-shanghai',
                    // Never accept VITE_ prefixed credentials: Vite exposes those to browser code.
                    accessKeyId: env.OSS_ACCESS_KEY_ID || process.env.OSS_ACCESS_KEY_ID || '',
                    accessKeySecret: env.OSS_ACCESS_KEY_SECRET || process.env.OSS_ACCESS_KEY_SECRET || '',
                    bucket: env.OSS_BUCKET || 'marius',
                    secure: true
                  });
                const fileExt = fileName.split('.').pop() || 'mp3';
                const randomName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExt}`;
                const ossPath = `audio/${randomName}`;
                const result = await client.put(ossPath, buffer);
                res.writeHead(200, { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': '*'
                });
                res.end(JSON.stringify({ url: result.url }));
              } catch (err: unknown) {
                console.error('Vite upload middleware error:', err);
                res.writeHead(500, { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': '*'
                });
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Upload failed' }));
              }
            });
          } else if (req.method === 'OPTIONS') {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': '*'
            });
            res.end();
          } else {
            res.writeHead(405).end();
          }
        });
      }
    }
  ],
  define: {
    __BUNDLED_DEV__: false,
    __SERVER_FORWARD_CONSOLE__: false
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          if (moduleId.includes('node_modules/react')) return 'react';
          if (moduleId.includes('node_modules/@supabase')) return 'supabase';
          return undefined;
        }
      }
    }
  },
  server: {
    cors: true,
    // Backend edits and package-manager temp dirs must not crash the Vite watcher.
    watch: {
      ignored: [
        '**/backend/**',
        '**/.git/**',
        '**/dist/**',
        '**/.pnpm-store/**',
        '**/*.tmpdir/**',
        '**/.package.json.*'
      ]
    },
    proxy: {
      '/api-gateway': {
        target: 'https://aigateway.edgecloudapp.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-gateway/, '')
      }
    }
  }
};
})

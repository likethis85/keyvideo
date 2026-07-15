import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'oss-upload-proxy',
        configureServer(server: any) {
          server.middlewares.use('/api/upload', (req: any, res: any) => {
            if (req.method === 'POST') {
              const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
              const fileName = urlObj.searchParams.get('name') || 'audio.mp3';

              const chunks: any[] = [];
              req.on('data', (chunk: any) => chunks.push(chunk));
              req.on('end', async () => {
                try {
                  const buffer = Buffer.concat(chunks);
                  const { default: OSS } = await import('ali-oss');
                  const client = new OSS({
                    region: 'oss-cn-shanghai',
                    accessKeyId: env.VITE_OSS_ACCESS_KEY_ID || '',
                    accessKeySecret: env.VITE_OSS_ACCESS_KEY_SECRET || '',
                    bucket: 'marius',
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
              } catch (err: any) {
                console.error('Vite upload middleware error:', err);
                res.writeHead(500, { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': '*'
                });
                res.end(JSON.stringify({ error: err.message || 'Upload failed' }));
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
  server: {
    cors: true,
    proxy: {
      '/api-gateway': {
        target: 'https://aigateway.edgecloudapp.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-gateway/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const targetUrl = req.headers['x-gateway-target'];
            if (typeof targetUrl === 'string' && targetUrl) {
              try {
                const parsedTarget = new URL(targetUrl);
                const targetPath = parsedTarget.pathname.replace(/\/+$/, '');
                proxyReq.path = targetPath + proxyReq.path;
              } catch (e) {
                console.error('Proxy request path rewriting failed:', e);
              }
            }
          });
        },
        // Typecast dynamic router option as any because vite's typings don't fully expose http-proxy's router option
        ...({
          router: (req: any) => {
            const targetUrl = req.headers['x-gateway-target'];
            return typeof targetUrl === 'string' ? targetUrl : undefined;
          }
        } as any)
      }
    }
  }
};
})

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = false;
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    // iisnode named pipe prefix: /pipe/<uuid>/...
    // Override req.url getter to strip it so Next.js sees clean URLs
    const rawUrl = req.url;
    if (rawUrl && rawUrl.startsWith('/pipe/')) {
      const slashIdx = rawUrl.indexOf('/', 7);
      if (slashIdx !== -1) {
        const cleanUrl = rawUrl.substring(slashIdx);
        Object.defineProperty(req, 'url', {
          get: () => cleanUrl,
          configurable: true,
          enumerable: true,
        });
      }
    }
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Request error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

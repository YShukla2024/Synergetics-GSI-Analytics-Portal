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
    // Strip iisnode named pipe prefix from URL
    if (req.url && req.url.includes('/pipe/')) {
      const match = req.url.match(/\/pipe\/[a-f0-9-]+(\/.*)/);
      if (match) req.url = match[1];
    }
    try {
      await handle(req, res, parse(req.url, true));
    } catch (err) {
      console.error('Error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

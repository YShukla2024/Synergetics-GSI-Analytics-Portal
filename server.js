const { createServer } = require('http');
const next = require('next');

const dev = false;
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    await handle(req, res);
  }).listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

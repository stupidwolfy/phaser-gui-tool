import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * A throwaway static server for the export tests.
 *
 * Exported output has to be *run*, and browsers refuse ES modules over
 * `file://` — which looks exactly like a broken export but is not. Serving the
 * generated files over HTTP is what makes the "drop it into your project" path
 * the thing being tested.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

export interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

export async function serveDirectory(root: string): Promise<StaticServer> {
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const path = join(root, relative === sep ? 'index.html' : relative);

    stat(path)
      .then((info) => {
        const file = info.isDirectory() ? join(path, 'index.html') : path;
        response.writeHead(200, {
          'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        });
        createReadStream(file).pipe(response);
      })
      .catch(() => {
        response.writeHead(404).end('not found');
      });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

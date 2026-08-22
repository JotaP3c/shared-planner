import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';
import { URL } from 'node:url';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const backendUrl = process.env['BACKEND_URL'];

if (backendUrl) {
  app.use('/api', (req, res, next) => {
    const target = new URL(req.originalUrl, backendUrl);
    const proxyRequest = (target.protocol === 'https:' ? httpsRequest : httpRequest)(
      target,
      {
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (proxyResponse) => {
        res.status(proxyResponse.statusCode ?? 502);
        for (const [name, value] of Object.entries(proxyResponse.headers)) {
          if (value !== undefined) res.setHeader(name, value);
        }
        proxyResponse.pipe(res);
      },
    );
    proxyRequest.on('error', next);
    req.pipe(proxyRequest);
  });
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

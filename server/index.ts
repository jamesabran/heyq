/**
 * `npm run server` (local) / `npm start` (hosted) entry point — boots the HeyQ
 * mock API server standalone.
 *
 * Hosts like Railway and Render inject the port to listen on via `PORT` and
 * expect the process to bind all interfaces, so we honor `PORT` first (falling
 * back to `HEYQ_API_PORT` for the existing local workflow) and bind `HOST`
 * (default `0.0.0.0`). Health check: GET /health (also /api/health).
 */
import { createHeyQServer } from './http.ts';

const port = Number(process.env.PORT) || Number(process.env.HEYQ_API_PORT) || 4310;
const host = process.env.HOST ?? '0.0.0.0';
createHeyQServer().listen(port, host, () => {
  console.log(`HeyQ mock API server listening on http://${host}:${port}`);
});

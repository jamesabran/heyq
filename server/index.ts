/** `npm run server` entry point — boots the HeyQ mock API server standalone. */
import { createHeyQServer } from './http.ts';

const port = Number(process.env.HEYQ_API_PORT) || 4310;
createHeyQServer().listen(port, () => {
  console.log(`HeyQ mock API server listening on http://localhost:${port}`);
});

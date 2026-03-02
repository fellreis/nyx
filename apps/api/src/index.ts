import { createApp } from './app.js';
import { ENV } from './config/env.js';

const app = createApp();
app.listen(ENV.PORT, () => {
  console.log(`API running on http://localhost:${ENV.PORT}`);
});

import 'dotenv/config';

import { createApp } from './app.js';

import { loadConfig } from './config/env.js';

const config = loadConfig();

const app = createApp(config);

app.listen(
  config.PORT,
  '127.0.0.1',
  () => {

    console.log(
      `API http://127.0.0.1:${config.PORT} | modo=${config.AI_EXECUTION_MODE}`
    );

  }
);
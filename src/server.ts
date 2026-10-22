import 'dotenv/config';

import { createApp } from './app.js';

import { loadConfig } from './config/env.js';

// 1. Cargar y validar configuración

const config = loadConfig();

// 2. Construir aplicación Express

const app = createApp(config);

// 3. Iniciar servidor HTTP

app.listen(
  config.PORT,
  '127.0.0.1',
  () => {

    console.log('--------------------------------');

    console.log('AI Knowledge Assistant');

    console.log(`Modo: ${config.AI_EXECUTION_MODE}`);

    console.log(
      `Servidor: http://127.0.0.1:${config.PORT}`
    );

    console.log(
      `Swagger UI: http://127.0.0.1:${config.PORT}/docs/`
    );

    console.log('--------------------------------');
  }
);
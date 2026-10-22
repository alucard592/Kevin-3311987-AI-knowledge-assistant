import request from 'supertest';

import {
  describe,
  expect,
  it
} from 'vitest';

import {
  createApp
} from '../src/app.js';

import {
  loadConfig
} from '../src/config/env.js';

const config = loadConfig({
  AI_EXECUTION_MODE: 'mock'
});

const app = createApp(config);

describe('Documentación OpenAPI', () => {

  it('expone la especificación JSON', async () => {

    const response = await request(app)
      .get('/openapi.json');

    expect(response.status).toBe(200);

    expect(response.body.openapi)
      .toBe('3.1.0');

    expect(
      response.body.paths['/health']
    ).toBeDefined();

    expect(
      response.body.paths['/api/v1/ask']
    ).toBeDefined();
  });

  it('sirve Swagger UI', async () => {

    const response = await request(app)
      .get('/docs/');

    expect(response.status).toBe(200);

    expect(
      response.headers['content-type']
    ).toContain('text/html');

    expect(response.text)
      .toContain('Swagger UI');
  });

  it('documenta el cuerpo de la petición', async () => {

    const response = await request(app)
      .get('/openapi.json');

    const schema =
      response.body.components.schemas.AskRequest;

    expect(
      schema.required
    ).toContain('question');

    expect(
      schema.properties.question.minLength
    ).toBe(3);
  });
});
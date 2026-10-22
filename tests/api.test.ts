import request from 'supertest';

import {
  describe,
  expect,
  it,
  vi,
  afterEach
} from 'vitest';

import { createApp } from '../src/app.js';

import { loadConfig } from '../src/config/env.js';

// Configuración para las pruebas

const config = loadConfig({
  AI_EXECUTION_MODE: 'mock',
  PORT: '3000'
});

const app = createApp(config);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API — Módulo 0', () => {

  // TEST 1: Health

  it('GET /health responde 200', async () => {

    const response = await request(app)
      .get('/health');

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      status: 'ok',
      mode: 'mock'
    });
  });

  // TEST 2: Pregunta correcta

  it('POST /api/v1/ask responde con MOCK', async () => {

    const response = await request(app)
      .post('/api/v1/ask')
      .send({
        question: '¿Qué es una API REST?'
      });

    expect(response.status).toBe(200);

    expect(response.body.data.mode)
      .toBe('mock');

    expect(response.body.data.model)
      .toBe('mock/educational-v1');

    expect(response.body.data.answer)
      .toContain('API REST');

    expect(response.body.data.usage)
      .toBeNull();
  });

  // TEST 3: Pregunta vacía

  it('rechaza pregunta vacía con HTTP 400', async () => {

    const response = await request(app)
      .post('/api/v1/ask')
      .send({
        question: ''
      });

    expect(response.status).toBe(400);

    expect(response.body.error.code)
      .toBe('VALIDATION_ERROR');
  });

  // TEST 4: Propiedades no permitidas

  it('rechaza campos adicionales', async () => {

    const response = await request(app)
      .post('/api/v1/ask')
      .send({
        question: 'Pregunta válida',
        role: 'admin'
      });

    expect(response.status).toBe(400);
  });

  // TEST 5: JSON inválido

  it('rechaza JSON mal formado', async () => {

    const response = await request(app)
      .post('/api/v1/ask')
      .set('Content-Type', 'application/json')
      .send('{"question":');

    expect(response.status).toBe(400);

    expect(response.body.error.code)
      .toBe('INVALID_JSON');
  });

  // TEST 6: Ruta inexistente

  it('devuelve 404 en ruta inexistente', async () => {

    const response = await request(app)
      .get('/ruta-inexistente');

    expect(response.status).toBe(404);

    expect(response.body.error.code)
      .toBe('NOT_FOUND');
  });

  // TEST 7: Identificador de solicitud

  it('incluye el mismo requestId en header y JSON', async () => {

    const response = await request(app)
      .post('/api/v1/ask')
      .send({
        question: 'Pregunta válida'
      });

    const headerRequestId =
      response.headers['x-request-id'];

    expect(headerRequestId).toBeDefined();

    expect(response.body.meta.requestId)
      .toBe(headerRequestId);
  });

  // TEST 8: MOCK sin llamadas externas

  it('no realiza llamadas externas en modo mock', async () => {

    const fetchSpy = vi.spyOn(
      globalThis,
      'fetch'
    ).mockRejectedValue(
      new Error('No se permite conexión externa')
    );

    const response = await request(app)
      .post('/api/v1/ask')
      .send({
        question: 'Pregunta válida'
      });

    expect(response.status).toBe(200);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
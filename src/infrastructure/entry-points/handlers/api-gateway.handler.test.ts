import type { APIGatewayProxyEvent } from 'aws-lambda';
import { routeApiGateway, type ApiDeps } from './api-gateway.handler.js';
import { AccountNotFoundException } from '@domain/model/errors.js';
import type { Account } from '@domain/model/account.js';

const acc = (id = 'acc-1'): Account => ({
  id,
  holderName: 'Jane',
  email: 'jane@example.com',
  accountType: 'SAVINGS',
  balance: 10,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
});

function deps(overrides: Partial<Record<keyof ApiDeps, unknown>> = {}): ApiDeps {
  return {
    create: { execute: jest.fn(async () => acc()) },
    get: { execute: jest.fn(async () => acc()) },
    update: { execute: jest.fn(async () => acc()) },
    patch: { execute: jest.fn(async () => ({ ...acc(), status: 'FROZEN' })) },
    delete: { execute: jest.fn(async () => undefined) },
    search: { execute: jest.fn(async () => [acc()]) },
    ...overrides,
  } as unknown as ApiDeps;
}

function evt(method: string, path: string, body?: unknown, id?: string): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    pathParameters: id ? { id } : null,
    queryStringParameters: null,
    body: body === undefined ? null : JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEvent;
}

const BASE = '/api/v1/accounts';

describe('routeApiGateway', () => {
  it('POST crea 201 y enmascara email', async () => {
    const res = await routeApiGateway(
      evt('POST', BASE, {
        holderName: 'Jane',
        email: 'jane@example.com',
        accountType: 'SAVINGS',
        initialBalance: 0,
      }),
      deps(),
    );
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).email).toBe('****@example.com');
  });

  it('POST invalido -> 400', async () => {
    const res = await routeApiGateway(evt('POST', BASE, { holderName: '', email: 'no' }), deps());
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('ACC-400-001');
  });

  it('GET by id -> 200', async () => {
    const res = await routeApiGateway(evt('GET', `${BASE}/acc-1`, undefined, 'acc-1'), deps());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe('acc-1');
  });

  it('GET inexistente -> 404 problem+json', async () => {
    const d = deps({
      get: {
        execute: jest.fn(async () => {
          throw new AccountNotFoundException('x');
        }),
      },
    });
    const res = await routeApiGateway(evt('GET', `${BASE}/x`, undefined, 'x'), d);
    expect(res.statusCode).toBe(404);
    expect(res.headers?.['Content-Type']).toContain('application/problem+json');
    expect(JSON.parse(res.body).code).toBe('ACC-404-001');
  });

  it('PUT reemplazo -> 200', async () => {
    const res = await routeApiGateway(
      evt(
        'PUT',
        `${BASE}/acc-1`,
        {
          holderName: 'New',
          email: 'n@x.com',
          accountType: 'CHECKING',
          initialBalance: 3,
        },
        'acc-1',
      ),
      deps(),
    );
    expect(res.statusCode).toBe(200);
  });

  it('PATCH parcial -> 200', async () => {
    const res = await routeApiGateway(
      evt('PATCH', `${BASE}/acc-1`, { status: 'FROZEN' }, 'acc-1'),
      deps(),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('FROZEN');
  });

  it('DELETE -> 204', async () => {
    const res = await routeApiGateway(evt('DELETE', `${BASE}/acc-1`, undefined, 'acc-1'), deps());
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('POST /search (busqueda con body) -> 200 lista', async () => {
    const res = await routeApiGateway(evt('POST', `${BASE}/search`, { status: 'ACTIVE' }), deps());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  it('ruta desconocida -> 404', async () => {
    const res = await routeApiGateway(evt('GET', '/nope'), deps());
    expect(res.statusCode).toBe(404);
  });

  it('error tecnico -> 500 sin detalle interno', async () => {
    const d = deps({
      get: {
        execute: jest.fn(async () => {
          throw new Error('db host leak');
        }),
      },
    });
    const res = await routeApiGateway(evt('GET', `${BASE}/x`, undefined, 'x'), d);
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('db host leak');
  });
});

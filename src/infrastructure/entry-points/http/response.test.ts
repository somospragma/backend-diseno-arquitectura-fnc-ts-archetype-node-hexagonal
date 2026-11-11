import { ok, noContent, problem, toProblem } from './response.js';
import {
  DomainException,
  BusinessException,
  TechnicalException,
  AccountNotFoundException,
} from '@domain/model/errors.js';

describe('response helpers', () => {
  it('ok incluye headers de seguridad y serializa el body', () => {
    const res = ok({ a: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers?.['X-Frame-Options']).toBe('DENY');
    expect(res.headers?.['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(res.headers?.['Content-Security-Policy']).toBe("default-src 'self'");
    expect(JSON.parse(res.body)).toEqual({ a: 1 });
  });

  it('ok respeta un status custom', () => {
    expect(ok({}, 201).statusCode).toBe(201);
  });

  it('noContent devuelve 204 sin body', () => {
    const res = noContent();
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('problem usa content-type application/problem+json', () => {
    const res = problem(422, 'ACC-422-001', 'invalid', { field: 'email' });
    expect(res.headers?.['Content-Type']).toBe('application/problem+json');
    expect(JSON.parse(res.body)).toEqual({
      code: 'ACC-422-001',
      status: 422,
      detail: 'invalid',
      field: 'email',
    });
  });
});

describe('toProblem', () => {
  it('BusinessException con codigo 404 -> 404', () => {
    expect(toProblem(new AccountNotFoundException('x')).statusCode).toBe(404);
  });

  it('BusinessException generica -> 422', () => {
    expect(toProblem(new BusinessException('ACC-422-002', 'nope')).statusCode).toBe(422);
  });

  it('TechnicalException -> 500 sin exponer detalle interno', () => {
    const res = toProblem(new TechnicalException('ACC-500-009', 'db secret leak', new Error('x')));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).detail).toBe('Internal error');
  });

  it('DomainException pura (ni Business ni Technical) -> 400', () => {
    // Subclase directa de DomainException para ejercitar el branch 400.
    class ValidationException extends DomainException {
      readonly code = 'ACC-400-050';
      constructor(message: string) {
        super(message);
      }
    }
    const res = toProblem(new ValidationException('bad input'));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('ACC-400-050');
  });

  it('error desconocido -> 500 generico', () => {
    const res = toProblem(new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).code).toBe('ACC-500-001');
  });
});

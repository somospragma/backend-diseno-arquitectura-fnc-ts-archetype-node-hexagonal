import type { APIGatewayProxyResult } from 'aws-lambda';
import { BusinessException, DomainException, TechnicalException } from '@domain/model/errors.js';

/** Headers de seguridad en todas las respuestas HTML/JSON (API-O-006 / SEG). */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
};

export function ok(body: unknown, status = 200): APIGatewayProxyResult {
  return { statusCode: status, headers: SECURITY_HEADERS, body: JSON.stringify(body) };
}

export function noContent(): APIGatewayProxyResult {
  return { statusCode: 204, headers: SECURITY_HEADERS, body: '' };
}

/** Problem Details (RFC 7807-like). Nunca expone stack traces ni detalle interno. */
export function problem(
  status: number,
  code: string,
  detail: string,
  extra: Record<string, unknown> = {},
): APIGatewayProxyResult {
  return {
    statusCode: status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/problem+json' },
    body: JSON.stringify({ code, status, detail, ...extra }),
  };
}

/** Traduce excepciones de dominio a Problem Details con el estado HTTP correcto. */
export function toProblem(err: unknown): APIGatewayProxyResult {
  if (err instanceof BusinessException) {
    const status = err.code.includes('404') ? 404 : 422;
    return problem(status, err.code, err.message);
  }
  if (err instanceof TechnicalException) {
    return problem(500, err.code, 'Internal error'); // sin detalle interno
  }
  if (err instanceof DomainException) {
    return problem(400, err.code, err.message);
  }
  return problem(500, 'ACC-500-001', 'Internal error');
}

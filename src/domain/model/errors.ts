/**
 * Jerarquia de errores de dominio. Los handlers los traducen a estados HTTP /
 * respuestas (RFC 7807-like). El dominio nunca conoce codigos HTTP.
 */
export abstract class DomainException extends Error {
  abstract readonly code: string;
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Error de negocio (mapeable a 4xx). */
export class BusinessException extends DomainException {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Error tecnico (mapeable a 5xx); nunca expone detalle interno al cliente. */
export class TechnicalException extends DomainException {
  readonly code: string;
  readonly cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

export class AccountNotFoundException extends BusinessException {
  constructor(id: string) {
    super('ACC-404-001', `Account not found: ${id}`);
  }
}

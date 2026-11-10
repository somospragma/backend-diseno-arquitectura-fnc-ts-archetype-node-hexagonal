/**
 * Modelo de dominio Account. Tipos planos, sin dependencias de framework ni de
 * infraestructura (hexagonal: el dominio no conoce AWS, DynamoDB ni handlers).
 */
export interface Account {
  id: string;
  holderName: string;
  /** Dato sensible (PII): se enmascara en logs y respuestas. */
  email: string;
  accountType: string;
  balance: number;
  status: AccountStatus;
  createdAt: string; // ISO-8601
}

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

/** Criterios de busqueda (campos nulos no filtran). */
export interface AccountSearchCriteria {
  status?: AccountStatus;
  accountType?: string;
  holderName?: string;
}

/** Evento de cuenta (historial / publicacion a SNS/EventBridge). */
export interface AccountEvent {
  accountId: string;
  eventId: string;
  type: string;
  occurredAt: string; // ISO-8601
}

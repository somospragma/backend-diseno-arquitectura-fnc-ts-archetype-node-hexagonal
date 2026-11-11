import type { AccountEvent } from '../model/account.js';

/** Puerto para publicar notificaciones fan-out (SNS). */
export interface INotificationPublisher {
  notify(event: AccountEvent): Promise<void>;
}

/** Puerto para publicar eventos de dominio a un bus (EventBridge). */
export interface IEventPublisher {
  publish(event: AccountEvent): Promise<void>;
}

/**
 * Puerto de idempotencia (SRV-O-002): markIfFirst devuelve true SOLO la primera
 * vez que se ve la clave; en reprocesos (SQS/EventBridge at-least-once) devuelve
 * false para saltar el efecto. El TTL acota la ventana de deduplicacion.
 */
export interface IIdempotencyStore {
  markIfFirst(key: string, ttlSeconds: number): Promise<boolean>;
}

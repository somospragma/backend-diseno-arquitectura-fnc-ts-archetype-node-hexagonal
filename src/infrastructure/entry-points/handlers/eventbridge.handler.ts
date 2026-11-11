import type { EventBridgeEvent } from 'aws-lambda';
import { container } from '@application/composition/container.js';
import type { IIdempotencyStore } from '@domain/ports/messaging.js';
import { logger } from '@infrastructure/helpers/observability.js';

const DEDUPE_TTL_SECONDS = 6 * 60 * 60;

type AnyEbEvent = EventBridgeEvent<string, unknown>;

export interface EventBridgeDeps {
  idempotencyStore: IIdempotencyStore;
  process: (event: AnyEbEvent) => Promise<void>;
}

/**
 * Consumidor EventBridge con idempotencia (SRV-O-002). Una regla EB entrega un
 * evento por invocacion; el dedupe por event.id evita duplicar efectos ante
 * reintentos (EB reintenta y manda a DLQ segun la regla).
 */
export async function processEventBridge(event: AnyEbEvent, deps: EventBridgeDeps): Promise<void> {
  const isFirst = await deps.idempotencyStore.markIfFirst(`eb:${event.id}`, DEDUPE_TTL_SECONDS);
  if (!isFirst) {
    logger.info('evento EventBridge duplicado; se ignora', { id: event.id });
    return;
  }
  await deps.process(event);
}

async function defaultProcess(event: AnyEbEvent): Promise<void> {
  logger.info('procesando evento EventBridge', { id: event.id, detailType: event['detail-type'] });
}

export const handler = (event: AnyEbEvent): Promise<void> =>
  processEventBridge(event, {
    idempotencyStore: container.idempotencyStore,
    process: defaultProcess,
  });

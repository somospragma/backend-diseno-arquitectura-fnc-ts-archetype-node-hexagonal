import type { SQSEvent, SQSBatchResponse, SQSRecord } from 'aws-lambda';
import { container } from '@application/composition/container.js';
import type { IIdempotencyStore } from '@domain/ports/messaging.js';
import { logger } from '@infrastructure/helpers/observability.js';

const DEDUPE_TTL_SECONDS = 6 * 60 * 60; // 6h

export interface SqsDeps {
  idempotencyStore: IIdempotencyStore;
  process: (record: SQSRecord) => Promise<void>;
}

/**
 * Consumidor SQS con PARTIAL BATCH FAILURE (SRV-BP-007) e IDEMPOTENCIA (SRV-O-002).
 * - Cada record se procesa aislado: un fallo NO tumba el batch entero.
 * - Los que fallan se reportan en batchItemFailures para que SQS los reintegre
 *   (y a DLQ tras maxReceiveCount). Requiere ReportBatchItemFailures en el ESM.
 * - Dedupe por messageId: reprocesos at-least-once no duplican el efecto.
 */
export async function processSqsBatch(event: SQSEvent, deps: SqsDeps): Promise<SQSBatchResponse> {
  const batchItemFailures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    try {
      const isFirst = await deps.idempotencyStore.markIfFirst(
        `sqs:${record.messageId}`,
        DEDUPE_TTL_SECONDS,
      );
      if (!isFirst) {
        logger.info('mensaje SQS duplicado; se ignora', { messageId: record.messageId });
        continue; // ya procesado: exito (no reintentar)
      }
      await deps.process(record);
    } catch (err) {
      logger.error('error procesando record SQS; se reintenta (partial batch failure)', {
        messageId: record.messageId,
        error: String(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}

/** Procesador de negocio de ejemplo (aqui iria el use case correspondiente). */
async function defaultProcess(record: SQSRecord): Promise<void> {
  logger.info('procesando mensaje SQS', { messageId: record.messageId });
}

export const handler = (event: SQSEvent): Promise<SQSBatchResponse> =>
  processSqsBatch(event, {
    idempotencyStore: container.idempotencyStore,
    process: defaultProcess,
  });

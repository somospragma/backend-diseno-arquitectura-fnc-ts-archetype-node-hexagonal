import type { SNSEvent, SNSEventRecord } from 'aws-lambda';
import { container } from '@application/composition/container.js';
import type { IIdempotencyStore } from '@domain/ports/messaging.js';
import { logger } from '@infrastructure/helpers/observability.js';

const DEDUPE_TTL_SECONDS = 6 * 60 * 60;

export interface SnsDeps {
  idempotencyStore: IIdempotencyStore;
  process: (record: SNSEventRecord) => Promise<void>;
}

/**
 * Consumidor SNS con idempotencia (SRV-O-002). SNS->Lambda no soporta partial
 * batch failure: si un record falla, se relanza para que SNS reintente/DLQ. El
 * dedupe por MessageId evita duplicar el efecto en reintentos.
 */
export async function processSnsEvent(event: SNSEvent, deps: SnsDeps): Promise<void> {
  for (const record of event.Records) {
    const messageId = record.Sns.MessageId;
    const isFirst = await deps.idempotencyStore.markIfFirst(`sns:${messageId}`, DEDUPE_TTL_SECONDS);
    if (!isFirst) {
      logger.info('notificacion SNS duplicada; se ignora', { messageId });
      continue;
    }
    await deps.process(record);
  }
}

async function defaultProcess(record: SNSEventRecord): Promise<void> {
  logger.info('procesando notificacion SNS', { messageId: record.Sns.MessageId });
}

export const handler = (event: SNSEvent): Promise<void> =>
  processSnsEvent(event, {
    idempotencyStore: container.idempotencyStore,
    process: defaultProcess,
  });

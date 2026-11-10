import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { AccountEvent } from '@domain/model/account.js';
import { TechnicalException } from '@domain/model/errors.js';
import type { IEventPublisher } from '@domain/ports/messaging.js';

const SCHEMA_VERSION = '1';

/**
 * Publisher de eventos de dominio a un bus EventBridge. Esquema versionado en el
 * detail; DetailType estable por tipo de evento. Traduce el fallo tecnico.
 */
export class EventBridgePublisher implements IEventPublisher {
  constructor(
    private readonly client: EventBridgeClient,
    private readonly busName: string,
    private readonly source = 'pragma.accounts',
  ) {}

  async publish(event: AccountEvent): Promise<void> {
    try {
      const res = await this.client.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: this.busName,
              Source: this.source,
              DetailType: event.type,
              Detail: JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...event }),
            },
          ],
        }),
      );
      if ((res.FailedEntryCount ?? 0) > 0) {
        throw new TechnicalException('ACC-500-004', 'EventBridge put failed entries');
      }
    } catch (e) {
      if (e instanceof TechnicalException) throw e;
      throw new TechnicalException('ACC-500-004', 'EventBridge publish failed', e);
    }
  }
}

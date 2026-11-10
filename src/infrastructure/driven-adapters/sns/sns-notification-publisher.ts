import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { AccountEvent } from '@domain/model/account.js';
import { TechnicalException } from '@domain/model/errors.js';
import type { INotificationPublisher } from '@domain/ports/messaging.js';

const SCHEMA_VERSION = '1';

/**
 * Publisher de notificaciones fan-out a SNS. Adjunta el esquema versionado como
 * message attribute (MSG-O-004) y traduce el fallo tecnico sin propagarlo crudo.
 */
export class SnsNotificationPublisher implements INotificationPublisher {
  constructor(
    private readonly sns: SNSClient,
    private readonly topicArn: string,
  ) {}

  async notify(event: AccountEvent): Promise<void> {
    try {
      await this.sns.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...event }),
          MessageAttributes: {
            schemaVersion: { DataType: 'String', StringValue: SCHEMA_VERSION },
            eventType: { DataType: 'String', StringValue: event.type },
          },
        }),
      );
    } catch (e) {
      throw new TechnicalException('ACC-500-003', 'SNS publish failed', e);
    }
  }
}

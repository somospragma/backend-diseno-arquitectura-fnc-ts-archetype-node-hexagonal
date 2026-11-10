import { mockClient } from 'aws-sdk-client-mock';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SnsNotificationPublisher } from './sns-notification-publisher.js';
import { TechnicalException } from '@domain/model/errors.js';
import type { AccountEvent } from '@domain/model/account.js';

const snsMock = mockClient(SNSClient);
const publisher = new SnsNotificationPublisher(new SNSClient({ region: 'us-east-1' }), 'arn:topic');

const event: AccountEvent = {
  accountId: 'acc-1',
  eventId: 'evt-1',
  type: 'AccountCreated',
  occurredAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => snsMock.reset());

describe('SnsNotificationPublisher', () => {
  it('publica con esquema versionado y message attributes', async () => {
    snsMock.on(PublishCommand).resolves({ MessageId: 'm-1' });
    await publisher.notify(event);
    const call = snsMock.commandCalls(PublishCommand)[0];
    expect(call.args[0].input.TopicArn).toBe('arn:topic');
    expect(call.args[0].input.MessageAttributes?.eventType?.StringValue).toBe('AccountCreated');
    expect(call.args[0].input.MessageAttributes?.schemaVersion?.StringValue).toBe('1');
    expect(JSON.parse(call.args[0].input.Message as string)).toMatchObject({
      schemaVersion: '1',
      accountId: 'acc-1',
      type: 'AccountCreated',
    });
  });

  it('traduce el fallo del SDK a TechnicalException (sin propagar crudo)', async () => {
    snsMock.on(PublishCommand).rejects(new Error('sns down'));
    await expect(publisher.notify(event)).rejects.toBeInstanceOf(TechnicalException);
  });
});

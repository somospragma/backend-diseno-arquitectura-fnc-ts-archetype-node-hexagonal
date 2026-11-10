import { mockClient } from 'aws-sdk-client-mock';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { EventBridgePublisher } from './eventbridge-publisher.js';
import { TechnicalException } from '@domain/model/errors.js';
import type { AccountEvent } from '@domain/model/account.js';

const ebMock = mockClient(EventBridgeClient);
const publisher = new EventBridgePublisher(
  new EventBridgeClient({ region: 'us-east-1' }),
  'accounts-bus',
);

const event: AccountEvent = {
  accountId: 'acc-1',
  eventId: 'evt-1',
  type: 'AccountUpdated',
  occurredAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => ebMock.reset());

describe('EventBridgePublisher', () => {
  it('publica una entry con DetailType estable y detail versionado', async () => {
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 });
    await publisher.publish(event);
    const entry = ebMock.commandCalls(PutEventsCommand)[0].args[0].input.Entries?.[0];
    expect(entry?.EventBusName).toBe('accounts-bus');
    expect(entry?.Source).toBe('pragma.accounts');
    expect(entry?.DetailType).toBe('AccountUpdated');
    expect(JSON.parse(entry?.Detail as string)).toMatchObject({
      schemaVersion: '1',
      accountId: 'acc-1',
    });
  });

  it('lanza TechnicalException cuando hay entries fallidas', async () => {
    ebMock.on(PutEventsCommand).resolves({ FailedEntryCount: 1 });
    await expect(publisher.publish(event)).rejects.toBeInstanceOf(TechnicalException);
  });

  it('traduce el fallo del SDK a TechnicalException', async () => {
    ebMock.on(PutEventsCommand).rejects(new Error('eb down'));
    await expect(publisher.publish(event)).rejects.toBeInstanceOf(TechnicalException);
  });
});

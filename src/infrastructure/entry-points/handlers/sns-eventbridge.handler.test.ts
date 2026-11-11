import type { SNSEvent, SNSEventRecord, EventBridgeEvent } from 'aws-lambda';
import { processSnsEvent } from './sns.handler.js';
import { processEventBridge } from './eventbridge.handler.js';
import type { IIdempotencyStore } from '@domain/ports/messaging.js';

function inMemoryStore(): IIdempotencyStore {
  const seen = new Set<string>();
  return { markIfFirst: async (k) => (seen.has(k) ? false : (seen.add(k), true)) };
}
function snsRec(id: string): SNSEventRecord {
  return { Sns: { MessageId: id, Message: '{}' } } as unknown as SNSEventRecord;
}

describe('processSnsEvent', () => {
  it('procesa e ignora duplicados por MessageId', async () => {
    const store = inMemoryStore();
    const process = jest.fn(async () => undefined);
    const ev = { Records: [snsRec('m1'), snsRec('m1'), snsRec('m2')] } as SNSEvent;
    await processSnsEvent(ev, { idempotencyStore: store, process });
    expect(process).toHaveBeenCalledTimes(2); // m1 una vez, m2 una vez
  });
});

describe('processEventBridge', () => {
  const ev = (id: string): EventBridgeEvent<string, unknown> =>
    ({ id, 'detail-type': 'ACCOUNT_CREATED', detail: {} }) as unknown as EventBridgeEvent<
      string,
      unknown
    >;

  it('procesa evento nuevo', async () => {
    const process = jest.fn(async () => undefined);
    await processEventBridge(ev('e1'), { idempotencyStore: inMemoryStore(), process });
    expect(process).toHaveBeenCalledTimes(1);
  });

  it('ignora evento duplicado por id', async () => {
    const store = inMemoryStore();
    const process = jest.fn(async () => undefined);
    await processEventBridge(ev('e1'), { idempotencyStore: store, process });
    await processEventBridge(ev('e1'), { idempotencyStore: store, process });
    expect(process).toHaveBeenCalledTimes(1);
  });
});

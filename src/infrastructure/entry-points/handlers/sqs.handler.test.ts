import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { processSqsBatch } from './sqs.handler.js';
import type { IIdempotencyStore } from '@domain/ports/messaging.js';

function rec(id: string, body = '{}'): SQSRecord {
  return { messageId: id, body } as unknown as SQSRecord;
}
function event(...ids: string[]): SQSEvent {
  return { Records: ids.map((i) => rec(i)) } as SQSEvent;
}
function inMemoryStore(): IIdempotencyStore {
  const seen = new Set<string>();
  return { markIfFirst: async (k) => (seen.has(k) ? false : (seen.add(k), true)) };
}

describe('processSqsBatch', () => {
  it('un record veneno no tumba el batch; se reporta en batchItemFailures', async () => {
    const store = inMemoryStore();
    const process = jest.fn(async (r: SQSRecord) => {
      if (r.messageId === 'bad') throw new Error('boom');
    });
    const res = await processSqsBatch(event('1', 'bad', '3'), { idempotencyStore: store, process });
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'bad' }]);
    expect(process).toHaveBeenCalledTimes(3);
  });

  it('mensaje duplicado se ignora (idempotencia) y no reprocesa', async () => {
    const store = inMemoryStore();
    const process = jest.fn(async () => undefined);
    await processSqsBatch(event('dup'), { idempotencyStore: store, process });
    await processSqsBatch(event('dup'), { idempotencyStore: store, process });
    expect(process).toHaveBeenCalledTimes(1);
  });

  it('batch todo OK -> sin fallos', async () => {
    const res = await processSqsBatch(event('1', '2'), {
      idempotencyStore: inMemoryStore(),
      process: jest.fn(async () => undefined),
    });
    expect(res.batchItemFailures).toHaveLength(0);
  });
});

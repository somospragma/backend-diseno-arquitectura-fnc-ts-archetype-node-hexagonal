import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoIdempotencyStore } from './dynamo-idempotency-store.js';

const ddbMock = mockClient(DynamoDBDocumentClient);
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const store = new DynamoIdempotencyStore(doc, 'idempotency');

beforeEach(() => ddbMock.reset());

describe('DynamoIdempotencyStore', () => {
  it('markIfFirst inserta condicional y devuelve true la primera vez', async () => {
    ddbMock.on(PutCommand).resolves({});
    expect(await store.markIfFirst('k1', 3600)).toBe(true);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input.ConditionExpression).toBe('attribute_not_exists(id)');
    expect(call.args[0].input.Item?.id).toBe('k1');
    // TTL en epoch seconds, en el futuro.
    expect(call.args[0].input.Item?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('markIfFirst devuelve false ante ConditionalCheckFailedException (duplicado)', async () => {
    const err = new Error('conditional failed');
    err.name = 'ConditionalCheckFailedException';
    ddbMock.on(PutCommand).rejects(err);
    expect(await store.markIfFirst('k1', 3600)).toBe(false);
  });

  it('markIfFirst propaga errores tecnicos no relacionados con la condicion', async () => {
    ddbMock.on(PutCommand).rejects(new Error('ddb down'));
    await expect(store.markIfFirst('k1', 3600)).rejects.toThrow('ddb down');
  });
});

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AccountDynamoRepository } from './account-dynamo-repository.js';
import { TechnicalException } from '@domain/model/errors.js';
import type { Account } from '@domain/model/account.js';

const ddbMock = mockClient(DynamoDBDocumentClient);
// El doc client se construye desde un base client REAL (no hace red al construir);
// aws-sdk-client-mock intercepta los comandos, por lo que nunca sale trafico.
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const repo = new AccountDynamoRepository(doc, 'accounts');

const acc: Account = {
  id: 'acc-1',
  holderName: 'Jane',
  email: 'j@x.com',
  accountType: 'SAVINGS',
  balance: 10,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => ddbMock.reset());

describe('AccountDynamoRepository', () => {
  it('save hace PutItem y retorna la cuenta', async () => {
    ddbMock.on(PutCommand).resolves({});
    expect(await repo.save(acc)).toEqual(acc);
  });

  it('findById retorna la cuenta o null', async () => {
    ddbMock.on(GetCommand).resolves({ Item: acc });
    expect((await repo.findById('acc-1'))?.id).toBe('acc-1');
    ddbMock.on(GetCommand).resolves({});
    expect(await repo.findById('x')).toBeNull();
  });

  it('existsById refleja presencia', async () => {
    ddbMock.on(GetCommand).resolves({ Item: acc });
    expect(await repo.existsById('acc-1')).toBe(true);
  });

  it('deleteById hace DeleteItem', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    await expect(repo.deleteById('acc-1')).resolves.toBeUndefined();
  });

  it('search usa QueryCommand (NUNCA Scan) con Limit', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [acc] });
    const out = await repo.search({ status: 'ACTIVE', accountType: 'SAVINGS' }, 10);
    expect(out).toHaveLength(1);
    const call = ddbMock.commandCalls(QueryCommand)[0];
    expect(call.args[0].input.Limit).toBe(10);
    expect(call.args[0].input.KeyConditionExpression).toContain('#st = :st');
  });

  it('mapea fallo del SDK a TechnicalException', async () => {
    ddbMock.on(GetCommand).rejects(new Error('ddb down'));
    await expect(repo.findById('x')).rejects.toBeInstanceOf(TechnicalException);
  });
});

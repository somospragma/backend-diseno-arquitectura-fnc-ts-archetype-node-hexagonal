import { processSfnTask, type SfnDeps } from './sfn-task.handler.js';
import { GetAccountUseCase } from '@domain/usecases/account-usecases.js';
import type { IAccountRepository } from '@domain/ports/account-repository.js';
import type { Account } from '@domain/model/account.js';
import { AccountNotFoundException } from '@domain/model/errors.js';

const ACC: Account = {
  id: 'acc-1',
  holderName: 'Jane',
  email: 'j@x.com',
  accountType: 'SAVINGS',
  balance: 10,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function repoWith(account: Account | null): IAccountRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(account),
    existsById: jest.fn().mockResolvedValue(account !== null),
    deleteById: jest.fn(),
    search: jest.fn().mockResolvedValue([]),
  };
}

function deps(seen: Set<string>, account: Account | null = ACC): SfnDeps {
  return {
    idempotencyStore: {
      markIfFirst: jest.fn(async (key: string) => {
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    },
    get: new GetAccountUseCase(repoWith(account)),
  };
}

describe('processSfnTask', () => {
  it('procesa el paso y devuelve la salida para el siguiente estado', async () => {
    const out = await processSfnTask(
      { accountId: 'acc-1', executionId: 'exec-1' },
      deps(new Set()),
    );
    expect(out).toEqual({ accountId: 'acc-1', status: 'ACTIVE', processed: true });
  });

  it('es idempotente: un reintento del estado no vuelve a marcar processed', async () => {
    const seen = new Set<string>();
    const d = deps(seen);
    const first = await processSfnTask({ accountId: 'acc-1', executionId: 'exec-1' }, d);
    const retry = await processSfnTask({ accountId: 'acc-1', executionId: 'exec-1' }, d);
    expect(first.processed).toBe(true);
    expect(retry.processed).toBe(false);
  });

  it('propaga el error crudo para que el Catch/Retry del estado decida', async () => {
    await expect(
      processSfnTask({ accountId: 'missing', executionId: 'exec-2' }, deps(new Set(), null)),
    ).rejects.toBeInstanceOf(AccountNotFoundException);
  });
});

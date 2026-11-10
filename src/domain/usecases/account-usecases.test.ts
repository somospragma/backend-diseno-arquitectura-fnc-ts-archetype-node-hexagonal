import {
  CreateAccountUseCase,
  GetAccountUseCase,
  UpdateAccountUseCase,
  PatchAccountUseCase,
  DeleteAccountUseCase,
  SearchAccountsUseCase,
} from './account-usecases.js';
import { AccountNotFoundException } from '../model/errors.js';
import type { IAccountRepository } from '../ports/account-repository.js';
import type { Account } from '../model/account.js';

function makeRepo(overrides: Partial<IAccountRepository> = {}): IAccountRepository {
  return {
    save: jest.fn(async (a: Account) => a),
    findById: jest.fn(async () => null),
    deleteById: jest.fn(async () => undefined),
    existsById: jest.fn(async () => false),
    search: jest.fn(async () => []),
    ...overrides,
  };
}

const sample = (id = 'acc-1'): Account => ({
  id,
  holderName: 'Jane',
  email: 'jane@example.com',
  accountType: 'SAVINGS',
  balance: 10,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('CreateAccountUseCase', () => {
  it('crea con estado ACTIVE, id y createdAt', async () => {
    const repo = makeRepo();
    const out = await new CreateAccountUseCase(repo).execute({
      holderName: 'Jane',
      email: 'jane@example.com',
      accountType: 'SAVINGS',
      initialBalance: 0,
    });
    expect(out.id).toBeTruthy();
    expect(out.status).toBe('ACTIVE');
    expect(out.createdAt).toBeTruthy();
    expect(repo.save).toHaveBeenCalled();
  });
});

describe('GetAccountUseCase', () => {
  it('retorna la cuenta si existe', async () => {
    const repo = makeRepo({ findById: jest.fn(async () => sample()) });
    expect((await new GetAccountUseCase(repo).execute('acc-1')).id).toBe('acc-1');
  });
  it('lanza 404 si no existe', async () => {
    await expect(new GetAccountUseCase(makeRepo()).execute('x')).rejects.toBeInstanceOf(
      AccountNotFoundException,
    );
  });
});

describe('UpdateAccountUseCase', () => {
  it('preserva id y createdAt del existente', async () => {
    const existing = sample();
    const repo = makeRepo({ findById: jest.fn(async () => existing) });
    const out = await new UpdateAccountUseCase(repo).execute('acc-1', {
      holderName: 'New',
      email: 'n@x.com',
      accountType: 'CHECKING',
      balance: 5,
      status: 'FROZEN',
    });
    expect(out.id).toBe('acc-1');
    expect(out.createdAt).toBe(existing.createdAt);
    expect(out.holderName).toBe('New');
  });
  it('lanza 404 si no existe', async () => {
    await expect(
      new UpdateAccountUseCase(makeRepo()).execute('x', {
        holderName: 'a',
        email: 'a@a.com',
        accountType: 'S',
        balance: 0,
        status: 'ACTIVE',
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundException);
  });
});

describe('PatchAccountUseCase', () => {
  it('aplica solo campos presentes', async () => {
    const repo = makeRepo({ findById: jest.fn(async () => sample()) });
    const out = await new PatchAccountUseCase(repo).execute('acc-1', { status: 'FROZEN' });
    expect(out.status).toBe('FROZEN');
    expect(out.holderName).toBe('Jane');
  });
  it('lanza 404 si no existe', async () => {
    await expect(new PatchAccountUseCase(makeRepo()).execute('x', {})).rejects.toBeInstanceOf(
      AccountNotFoundException,
    );
  });
});

describe('DeleteAccountUseCase', () => {
  it('borra si existe', async () => {
    const repo = makeRepo({ existsById: jest.fn(async () => true) });
    await new DeleteAccountUseCase(repo).execute('acc-1');
    expect(repo.deleteById).toHaveBeenCalledWith('acc-1');
  });
  it('lanza 404 y no borra si no existe', async () => {
    const repo = makeRepo({ existsById: jest.fn(async () => false) });
    await expect(new DeleteAccountUseCase(repo).execute('x')).rejects.toBeInstanceOf(
      AccountNotFoundException,
    );
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});

describe('SearchAccountsUseCase', () => {
  it('aplica tope duro de 100', async () => {
    const repo = makeRepo({ search: jest.fn(async () => [sample()]) });
    await new SearchAccountsUseCase(repo).execute({ status: 'ACTIVE' }, 9999);
    expect(repo.search).toHaveBeenCalledWith({ status: 'ACTIVE' }, 100);
  });
  it('usa 20 por defecto', async () => {
    const repo = makeRepo({ search: jest.fn(async () => []) });
    await new SearchAccountsUseCase(repo).execute({});
    expect(repo.search).toHaveBeenCalledWith({}, 20);
  });
});

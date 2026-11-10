import {
  getPool,
  _resetPoolForTest,
  type SqlConnectionPool,
  type PoolFactory,
} from './connection-pool.js';

function stubPool(): SqlConnectionPool {
  return {
    query: jest.fn().mockResolvedValue([]),
    end: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => _resetPoolForTest());

describe('connection-pool (SRV-O-005)', () => {
  it('crea el pool con max=1 (consciente de Lambda)', () => {
    const factory: PoolFactory = jest.fn(() => stubPool());
    getPool(factory, { host: 'h', database: 'd' });
    expect(factory).toHaveBeenCalledWith({ host: 'h', database: 'd', max: 1 });
  });

  it('reutiliza el mismo pool entre invocaciones (singleton, warm start)', () => {
    const factory: PoolFactory = jest.fn(() => stubPool());
    const a = getPool(factory, { host: 'h', database: 'd' });
    const b = getPool(factory, { host: 'h', database: 'd' });
    expect(a).toBe(b);
    expect(factory).toHaveBeenCalledTimes(1); // solo una creacion (cold start)
  });

  it('_resetPoolForTest fuerza recreacion', () => {
    const factory: PoolFactory = jest.fn(() => stubPool());
    getPool(factory, { host: 'h', database: 'd' });
    _resetPoolForTest();
    getPool(factory, { host: 'h', database: 'd' });
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

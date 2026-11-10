import { RedisCacheGateway, type RedisLikeClient } from './redis-cache-gateway.js';

function fakeClient(overrides: Partial<RedisLikeClient> = {}): RedisLikeClient {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

describe('RedisCacheGateway', () => {
  it('get devuelve el valor en hit', async () => {
    const gw = new RedisCacheGateway(fakeClient({ get: jest.fn().mockResolvedValue('v') }));
    expect(await gw.get('k')).toBe('v');
  });

  it('get degrada a null (miss) si Redis falla', async () => {
    const gw = new RedisCacheGateway(
      fakeClient({ get: jest.fn().mockRejectedValue(new Error('down')) }),
    );
    expect(await gw.get('k')).toBeNull();
  });

  it('put escribe con TTL y devuelve true', async () => {
    const set = jest.fn().mockResolvedValue('OK');
    const gw = new RedisCacheGateway(fakeClient({ set }));
    expect(await gw.put('k', 'v', 60)).toBe(true);
    expect(set).toHaveBeenCalledWith('k', 'v', 'EX', 60);
  });

  it('put exige TTL obligatorio y positivo', async () => {
    const gw = new RedisCacheGateway(fakeClient());
    await expect(gw.put('k', 'v', 0)).rejects.toThrow('TTL is mandatory');
    await expect(gw.put('k', 'v', -1)).rejects.toThrow('TTL is mandatory');
  });

  it('put degrada a false si Redis falla', async () => {
    const gw = new RedisCacheGateway(
      fakeClient({ set: jest.fn().mockRejectedValue(new Error('down')) }),
    );
    expect(await gw.put('k', 'v', 60)).toBe(false);
  });

  it('evict devuelve true/false segun eliminacion y degrada ante error', async () => {
    expect(
      await new RedisCacheGateway(fakeClient({ del: jest.fn().mockResolvedValue(1) })).evict('k'),
    ).toBe(true);
    expect(
      await new RedisCacheGateway(fakeClient({ del: jest.fn().mockResolvedValue(0) })).evict('k'),
    ).toBe(false);
    expect(
      await new RedisCacheGateway(
        fakeClient({ del: jest.fn().mockRejectedValue(new Error('down')) }),
      ).evict('k'),
    ).toBe(false);
  });
});

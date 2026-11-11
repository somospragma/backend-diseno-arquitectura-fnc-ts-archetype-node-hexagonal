import type { ICacheGateway } from '@domain/ports/cache.js';
import { logger } from '@infrastructure/helpers/observability.js';

/**
 * Cliente Redis minimo que el adapter necesita (inyectable). El driver real
 * (ioredis) se pasa desde la composicion para no acoplar el arquetipo a una dep
 * concreta ni forzarla en el bundle del cold path.
 */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
}

/**
 * Cache remoto (Redis) con TTL obligatorio y DEGRADACION: si Redis falla, el
 * cache no rompe el flujo de negocio (get -> null, put -> false). El caller
 * sigue a la fuente de verdad (PERF-BP + RES-O-005).
 */
export class RedisCacheGateway implements ICacheGateway {
  constructor(private readonly client: RedisLikeClient) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (e) {
      logger.warn('cache get fallo; se degrada a miss', { key, error: String(e) });
      return null;
    }
  }

  async put(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!ttlSeconds || ttlSeconds <= 0) {
      throw new Error('TTL is mandatory and must be positive');
    }
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return true;
    } catch (e) {
      logger.warn('cache put fallo; se ignora (degradacion)', { key, error: String(e) });
      return false;
    }
  }

  async evict(key: string): Promise<boolean> {
    try {
      return (await this.client.del(key)) > 0;
    } catch {
      return false;
    }
  }
}

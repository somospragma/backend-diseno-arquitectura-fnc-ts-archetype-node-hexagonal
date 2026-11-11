/**
 * Puerto de cache remoto (Redis). El TTL es obligatorio al escribir (nunca cache
 * eterno). La degradacion (fallar sin romper el flujo) la implementa el adapter.
 */
export interface ICacheGateway {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  evict(key: string): Promise<boolean>;
}

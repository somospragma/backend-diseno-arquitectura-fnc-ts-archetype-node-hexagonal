/**
 * Conexion a BD relacional consciente del modelo Lambda (SRV-O-005).
 *
 * Regla: pool con max=1 CREADO FUERA del handler (a nivel de modulo) y reutilizado
 * entre invocaciones en el mismo contenedor caliente. Alternativas validas: RDS
 * Proxy o Data API. Nunca abrir/cerrar conexion por invocacion.
 *
 * Aqui se modela el contrato (interfaz) y una fabrica; el driver real (p.ej. `pg`)
 * se inyecta para no acoplar el arquetipo a un motor concreto ni forzar la dep.
 */
export interface SqlConnectionPool {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  end(): Promise<void>;
}

export interface PoolFactory {
  (config: { host: string; database: string; max: number }): SqlConnectionPool;
}

let cachedPool: SqlConnectionPool | undefined;

/**
 * Devuelve un pool singleton (max=1) reutilizado entre invocaciones. El pool se
 * crea una sola vez por contenedor (cold start) y se reutiliza en warm starts.
 */
export function getPool(
  factory: PoolFactory,
  cfg: { host: string; database: string },
): SqlConnectionPool {
  if (!cachedPool) {
    cachedPool = factory({ ...cfg, max: 1 }); // max=1: consciente de Lambda
  }
  return cachedPool;
}

/** Visible para test: resetea el singleton. */
export function _resetPoolForTest(): void {
  cachedPool = undefined;
}

# Accounts Serverless (Node + TypeScript)

Arquetipo base de Pragma para microservicios **serverless** en **Node 22+ / TypeScript**
con arquitectura hexagonal, empaquetado con **pnpm** y **esbuild**. Es el showcase de
referencia de la policy `pragma-node-serverless`: un dominio de ejemplo (`accounts`)
que ejercita todo el framework de madurez backend enfocado en serverless.

No es solo AWS Lambda como concepto aislado: es el patron general serverless (handlers
por evento, sin estado en memoria, idempotencia, cold start, partial batch failure)
sobre AWS (API Gateway, SQS, SNS, EventBridge, DynamoDB).

## Requisitos

- Node.js >= 22 (probado en Node 24).
- pnpm >= 10 (via corepack: `corepack enable && corepack prepare pnpm@10.19.0 --activate`).

## Comandos

| Comando | Descripcion |
|---|---|
| `pnpm install` | Instala dependencias (lockfile `pnpm-lock.yaml`, versiones exactas). |
| `pnpm typecheck` | Chequeo de tipos estricto (`tsc --noEmit`). |
| `pnpm lint` | ESLint sobre `src/**/*.ts`. |
| `pnpm format:check` | Verifica formato con Prettier. |
| `pnpm test` | Jest + ts-jest (ESM) con gate de cobertura (lines 90 / stmt 90 / func 85 / branch 80). |
| `pnpm build` | Bundle por handler con esbuild (un `.mjs` liviano por Lambda). |
| `pnpm check` | `typecheck` + `lint` + `test` (gate integral). |

El AWS SDK v3 se marca `external` en el bundle porque el runtime de Lambda lo provee
(mitigacion de cold start, SRV-BP-006); Powertools si se bundlea.

## Estructura hexagonal

```
src/
  domain/                         # NUCLEO framework-free (sin AWS, sin handlers)
    model/                        # Account, AccountEvent, AccountStatus, errores de dominio
    ports/                        # IAccountRepository, IIdempotencyStore, IEventPublisher,
                                  # INotificationPublisher, ICacheGateway
    usecases/                     # Create/Get/Update/Patch/Delete/Search (logica de negocio)
  infrastructure/
    entry-points/
      handlers/                   # Handlers serverless (adaptadores de entrada por evento)
        api-gateway.handler.ts    #  - API Gateway (REST proxy, todos los verbos + POST /search)
        sqs.handler.ts            #  - SQS (partial batch failure + idempotencia)
        sns.handler.ts            #  - SNS (fan-out)
        eventbridge.handler.ts    #  - EventBridge (bus de eventos)
      http/                       # response.ts (Problem Details + headers seguridad), account.dto.ts (zod)
    driven-adapters/              # Adaptadores de salida (implementan los ports)
      dynamodb/                   #  - Repositorio (Query, NUNCA Scan) + store de idempotencia
      sns/                        #  - Publisher de notificaciones
      eventbridge/                #  - Publisher de eventos
      cache/                      #  - Redis (TTL obligatorio + degradacion)
      rds/                        #  - Pool consciente de Lambda (max=1, fuera del handler)
    helpers/                      # masking (PII), observability (Powertools logger/metrics/tracer)
  application/
    composition/                  # container.ts (composition root; wiring a nivel de modulo)
```

Regla de dependencia hacia adentro: `domain/` no importa nada de `infrastructure/`,
`application/` ni AWS. Los handlers exportan una funcion core testeable
(`routeApiGateway`, `processSqsBatch`, `processSnsEvent`, `processEventBridge`) y un
`handler` que la cablea con el `container`.

## Handlers serverless

- **API Gateway** (`api-gateway.handler.ts`): REST proxy `/api/v1/accounts`. Ejemplifica
  GET (uno), POST (201), PUT, PATCH, DELETE (204) y busqueda portable `POST /accounts/search`
  (QUERY es aspiracional: API Gateway no enruta el metodo QUERY).
- **SQS** (`sqs.handler.ts`): partial batch failure (`ReportBatchItemFailures`, SRV-BP-007)
  e idempotencia por `messageId` (SRV-O-002).
- **SNS** (`sns.handler.ts`): consumo de notificaciones fan-out, idempotente.
- **EventBridge** (`eventbridge.handler.ts`): consumo de eventos del bus, idempotente.
- **Step Functions task** (`sfn-task.handler.ts`): un paso de orquestacion. Recibe el input del
  estado `Task` (no un evento API GW/SQS), delega en un use case y devuelve la salida para el
  siguiente estado. Idempotente por `executionId`. Los errores se propagan crudos: el `Retry`/`Catch`
  del estado en el ASL decide el reintento, no un try/catch en el codigo. La maquina de estados de
  referencia esta en `statemachine/accounts.asl.json` (Retry/Catch por estado, `TimeoutSeconds`,
  `Map` con `MaxConcurrency`, ruta de fallo a DLQ). Aplica solo si el servicio orquesta con SFN.

## Alineacion con el framework serverless (SRV-*)

- **SRV-O-002 Idempotencia**: `IIdempotencyStore` + `DynamoIdempotencyStore` (PutItem condicional
  `attribute_not_exists` con TTL). Handlers SQS/SNS/EventBridge deduplican por id de evento.
- **SRV-O-004 Sin estado en memoria**: el `container` y los clientes AWS se crean a nivel de
  modulo (reutilizados en warm start) pero NO guardan estado de negocio mutable; el estado vive
  en DynamoDB.
- **SRV-O-005 Conexiones conscientes de Lambda**: `rds/connection-pool.ts` crea el pool con `max=1`
  FUERA del handler (singleton por contenedor). Alternativas validas: RDS Proxy / Data API.
- **SRV-BP-006 Cold start**: esbuild produce un bundle minimo por handler; AWS SDK marcado external.
- **SRV-BP-007 Partial batch failure**: el handler SQS retorna `batchItemFailures`.

## Observabilidad y errores

- Logs estructurados JSON, metricas y tracing con AWS Lambda Powertools
  (`helpers/observability.ts`), sin PII (`helpers/masking.ts`).
- Errores tipo RFC 7807 (`http/response.ts`): `Problem Details` con headers de seguridad
  (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) y sin exponer detalle
  interno en 5xx.
- Validacion de entrada estricta con zod (`http/account.dto.ts`).

## Nota sobre `/actuator`

En serverless NO aplica un endpoint `/actuator/health` estilo Spring: el health y las metricas
se observan via CloudWatch/Powertools y (opcionalmente) health checks del propio evento (API
Gateway health route). La observabilidad se resuelve con logs/metrics/traces, no con un endpoint
de management embebido.

## Testing

Tests con Jest + ts-jest en modo ESM y mocks de `aws-sdk-client-mock` (sin SAM ni LocalStack):
cada handler expone una funcion core testeable, y los adaptadores se prueban interceptando los
comandos del SDK. Gate de cobertura configurado en `jest.config.mjs`.

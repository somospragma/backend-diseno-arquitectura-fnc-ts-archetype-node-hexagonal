import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { container } from '@application/composition/container.js';
import type {
  CreateAccountUseCase,
  GetAccountUseCase,
  UpdateAccountUseCase,
  PatchAccountUseCase,
  DeleteAccountUseCase,
  SearchAccountsUseCase,
} from '@domain/usecases/account-usecases.js';
import {
  createAccountSchema,
  patchAccountSchema,
  searchAccountSchema,
} from '@infrastructure/entry-points/http/account.dto.js';
import { maskAccount } from '@infrastructure/helpers/masking.js';
import { ok, noContent, problem, toProblem } from '@infrastructure/entry-points/http/response.js';

export interface ApiDeps {
  create: CreateAccountUseCase;
  get: GetAccountUseCase;
  update: UpdateAccountUseCase;
  patch: PatchAccountUseCase;
  delete: DeleteAccountUseCase;
  search: SearchAccountsUseCase;
}

const BASE = '/api/v1/accounts';

function parseBody(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw);
}

/**
 * Router HTTP puro (testeable) que ejemplifica los metodos: GET (uno/lista),
 * POST (201), PUT (reemplazo total), PATCH (parcial), DELETE (204) y una busqueda
 * segura (QUERY es aspiracional en el stack; API Gateway no enruta QUERY, por eso
 * la busqueda con body se expone en POST /accounts/search de forma portable).
 */
export async function routeApiGateway(
  event: APIGatewayProxyEvent,
  deps: ApiDeps,
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod.toUpperCase();
  const path = event.path;
  const id = event.pathParameters?.id;
  try {
    if (method === 'POST' && path === `${BASE}/search`) {
      const criteria = searchAccountSchema.parse(parseBody(event));
      const size = Number(event.queryStringParameters?.size ?? 20);
      const result = await deps.search.execute(criteria, size);
      return ok(result.map(maskAccount));
    }
    if (method === 'GET' && id) {
      return ok(maskAccount(await deps.get.execute(id)));
    }
    if (method === 'POST' && path === BASE) {
      const dto = createAccountSchema.parse(parseBody(event));
      return ok(maskAccount(await deps.create.execute(dto)), 201);
    }
    if (method === 'PUT' && id) {
      const dto = createAccountSchema.parse(parseBody(event));
      const updated = await deps.update.execute(id, {
        holderName: dto.holderName,
        email: dto.email,
        accountType: dto.accountType,
        balance: dto.initialBalance,
        status: 'ACTIVE',
      });
      return ok(maskAccount(updated));
    }
    if (method === 'PATCH' && id) {
      const dto = patchAccountSchema.parse(parseBody(event));
      return ok(maskAccount(await deps.patch.execute(id, dto)));
    }
    if (method === 'DELETE' && id) {
      await deps.delete.execute(id);
      return noContent();
    }
    return problem(404, 'ACC-404-000', `No route for ${method} ${path}`);
  } catch (err) {
    if (err instanceof Error && err.name === 'ZodError') {
      return problem(400, 'ACC-400-001', 'Validation failed');
    }
    return toProblem(err);
  }
}

/** Entry-point Lambda (API Gateway proxy). */
export const handler = (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  routeApiGateway(event, container.useCases);

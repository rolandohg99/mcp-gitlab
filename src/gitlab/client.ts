export class GitLabError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "GitLabError";
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
}

/** Codifica un proyecto (path con namespace o ID) para la ruta de la API. */
export function encodeProject(project: string | number): string {
  return encodeURIComponent(String(project));
}

export class GitLabClient {
  private readonly apiBase: string;
  private readonly graphqlUrl: string;

  /**
   * `pat` manda PRIVATE-TOKEN (tokens personales); `bearer`, Authorization
   * (tokens OAuth). GitLab no acepta un token OAuth por PRIVATE-TOKEN.
   */
  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly modo: "pat" | "bearer" = "pat"
  ) {
    const base = baseUrl.replace(/\/+$/, "");
    this.apiBase = `${base}/api/v4`;
    this.graphqlUrl = `${base}/api/graphql`;
  }

  private authHeader(): Record<string, string> {
    return this.modo === "bearer"
      ? { Authorization: `Bearer ${this.token}` }
      : { "PRIVATE-TOKEN": this.token };
  }

  /**
   * Los timelogs solo son consultables por GraphQL: la REST v4 expone totales
   * por issue, no los registros individuales con su fecha.
   */
  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.graphqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeader() },
        body: JSON.stringify({ query, variables })
      });
    } catch (cause) {
      throw new GitLabError(`No se pudo conectar con GraphQL: ${(cause as Error).message}`, 0, cause);
    }

    if (!response.ok) {
      throw new GitLabError(`GraphQL respondio ${response.status}`, response.status);
    }

    const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (payload.errors?.length) {
      throw new GitLabError(
        `GraphQL: ${payload.errors.map((e) => e.message).join("; ")}`,
        400,
        payload.errors
      );
    }
    return payload.data as T;
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(`${this.apiBase}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<{ data: T; headers: Headers }> {
    const { method = "GET", query, body } = options;
    const headers: Record<string, string> = { ...this.authHeader() };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(this.buildUrl(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (cause) {
      throw new GitLabError(
        `No se pudo conectar con GitLab: ${(cause as Error).message}`,
        0,
        cause
      );
    }

    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      throw new GitLabError(
        describeError(response.status, payload),
        response.status,
        payload
      );
    }

    return { data: payload as T, headers: response.headers };
  }

  get<T>(path: string, query?: Record<string, QueryValue>) {
    return this.request<T>(path, { query });
  }

  post<T>(path: string, body: unknown, query?: Record<string, QueryValue>) {
    return this.request<T>(path, { method: "POST", body, query });
  }

  put<T>(path: string, body: unknown, query?: Record<string, QueryValue>) {
    return this.request<T>(path, { method: "PUT", body, query });
  }

  /** Recorre la paginacion por keyset/offset hasta agotar o alcanzar maxItems. */
  async getAll<T>(
    path: string,
    query: Record<string, QueryValue> = {},
    maxItems = 200
  ): Promise<T[]> {
    const perPage = Math.min(100, maxItems);
    const items: T[] = [];
    let page = 1;

    while (items.length < maxItems) {
      const { data, headers } = await this.get<T[]>(path, {
        ...query,
        per_page: perPage,
        page
      });
      if (!Array.isArray(data) || data.length === 0) break;
      items.push(...data);

      const next = headers.get("x-next-page");
      if (!next) break;
      page = Number(next);
      if (!Number.isFinite(page) || page <= 0) break;
    }

    return items.slice(0, maxItems);
  }
}

function describeError(status: number, payload: unknown): string {
  const detail =
    typeof payload === "string"
      ? payload
      : (payload as { message?: unknown; error?: unknown })?.message ??
        (payload as { error?: unknown })?.error;

  const suffix = detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : "";

  switch (status) {
    case 401:
      return `Token invalido o expirado (401)${suffix}`;
    case 403:
      return `El token no tiene permisos para esta operacion (403)${suffix}`;
    case 404:
      return `Recurso no encontrado (404). Revisa el path del proyecto o el IID${suffix}`;
    default:
      return `GitLab respondio ${status}${suffix}`;
  }
}

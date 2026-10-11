export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function kall<T>(metode: string, sti: string, body?: unknown): Promise<T> {
  const res = await fetch(sti, {
    method: metode,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { feil?: string };
  if (!res.ok) throw new ApiError(res.status, data.feil ?? `Noe gikk galt (${res.status})`);
  return data as T;
}

export const apiGet = <T>(sti: string) => kall<T>("GET", sti);
export const apiPost = <T>(sti: string, body?: unknown) => kall<T>("POST", sti, body ?? {});
export const apiPut = <T>(sti: string, body: unknown) => kall<T>("PUT", sti, body);
export const apiPatch = <T>(sti: string, body: unknown) => kall<T>("PATCH", sti, body);
export const apiDelete = (sti: string) => kall<unknown>("DELETE", sti).then(() => undefined);

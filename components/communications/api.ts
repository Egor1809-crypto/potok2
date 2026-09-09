export async function communicationApi<T>(body?: unknown, query = "", signal?: AbortSignal): Promise<T> {
    const response = await fetch(`/api/communications${query}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal } : { cache: "no-store", signal });
    const data = await response.json() as T & {
        error?: string;
    };
    if (!response.ok)
        throw new Error(data.error ?? "Не удалось загрузить данные.");
    return data;
}

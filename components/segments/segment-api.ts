import type {
  DeleteResponse,
  SegmentCreateInput,
  SegmentMutationResponse,
  SegmentPatchInput,
  SegmentRecord,
  SegmentsListResponse,
} from "@/types/api";

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; details?: string[] })
    | null;

  if (!response.ok) {
    const details = payload?.details?.filter(Boolean).join(" ");
    throw new Error(
      [payload?.error, details].filter(Boolean).join(" ") ||
        `Сервер вернул ошибку ${response.status}.`,
    );
  }

  if (!payload) {
    throw new Error("Сервер вернул пустой ответ.");
  }

  return payload;
}

function mutationSegment(payload: SegmentMutationResponse): SegmentRecord {
  if (
    !payload.segment ||
    typeof payload.segment.id !== "string" ||
    !Array.isArray(payload.segment.rules)
  ) {
    throw new Error("Сервер вернул неверные данные сегмента.");
  }
  return payload.segment;
}

export async function getSegments(signal?: AbortSignal): Promise<SegmentRecord[]> {
  const response = await fetch("/api/segments", {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await readResponse<SegmentsListResponse>(response);
  if (!Array.isArray(payload.segments)) {
    throw new Error("Сервер вернул неверный список сегментов.");
  }
  return payload.segments;
}

export async function createSegment(
  input: SegmentCreateInput,
): Promise<SegmentRecord> {
  const response = await fetch("/api/segments", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await readResponse<SegmentMutationResponse>(response);
  return mutationSegment(payload);
}

export async function updateSegment(
  input: SegmentPatchInput,
): Promise<SegmentRecord> {
  const response = await fetch("/api/segments", {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await readResponse<SegmentMutationResponse>(response);
  return mutationSegment(payload);
}

export async function removeSegment(id: string): Promise<string> {
  const response = await fetch(`/api/segments?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  const payload = await readResponse<DeleteResponse>(response);
  if (typeof payload.deletedId !== "string") {
    throw new Error("Сервер не подтвердил удаление сегмента.");
  }
  return payload.deletedId;
}

import { startYandex } from "@/lib/server/yandex-auth";
import { jsonError } from "@/lib/server/api-utils";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { return await startYandex(request); } catch(error) { return jsonError(error); } }

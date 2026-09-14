import { yandexClientId } from "@/lib/server/yandex-auth";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json({configured: Boolean(yandexClientId())},{headers:{"Cache-Control":"no-store"}}); }

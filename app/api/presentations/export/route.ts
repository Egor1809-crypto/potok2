import { jsonError } from "@/lib/server/api-utils";
import {
  buildPresentationPptx,
  safePresentationFilename,
} from "@/lib/server/presentation-pptx";
import { getPresentationProject } from "@/lib/server/presentation-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const { presentation } = await getPresentationProject(request, id);
    const bytes = await buildPresentationPptx(request, presentation);
    const filename = safePresentationFilename(presentation.name);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="presentation.pptx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

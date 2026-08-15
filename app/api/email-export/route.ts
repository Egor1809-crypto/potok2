import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import { compileEmailDocument, emailDocumentPlainText, parseEmailBuilderDocument } from "@/lib/server/email-document";
import { compilePortableEmailDocument } from "@/lib/server/email-export";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const document = parseEmailBuilderDocument(await readJsonBody(request));
    if (!document) return Response.json({ error: "Макет письма не распознан." }, { status: 400 });
    const portable = new URL(request.url).searchParams.get("portable") === "1";
    return Response.json({
      html: portable
        ? await compilePortableEmailDocument(request, document)
        : compileEmailDocument(document),
      text: emailDocumentPlainText(document),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

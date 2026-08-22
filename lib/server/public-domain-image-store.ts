import { findPublicDomainImageCandidates } from "@/lib/public-domain-images";

import { storeGeneratedEmailAsset } from "./email-asset-store";

export async function storePublicDomainFallbackImage(
  request: Request,
  prompt: string,
  filename: string,
) {
  const candidates = await findPublicDomainImageCandidates(prompt);
  for (const candidate of candidates.slice(0, 6)) {
    try {
      return await storeGeneratedEmailAsset(
        request,
        candidate.url,
        "photo",
        filename,
      );
    } catch {
      // Public mirrors differ in availability and MIME accuracy. Try the next
      // verified CC0/PDM candidate before giving up on the visual.
    }
  }
  return null;
}

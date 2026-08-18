export type InlineEmailImage = {
  filename: string;
  contentId: string;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  bytes: Uint8Array;
};

const DATA_IMAGE_PATTERN = /\bsrc=(['"])(data:(image\/(?:jpeg|png|gif|webp));base64,([^'"]+))\1/gi;

function extensionFor(mimeType: InlineEmailImage["mimeType"]) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * data: URI are blocked by Gmail and other email clients. Replace them with
 * inline MIME references and return the binary parts required by the sender.
 */
export function extractInlineEmailImages(
  html: string,
  reference: "filename" | "cid",
): { html: string; images: InlineEmailImage[] } {
  const imageBySource = new Map<string, InlineEmailImage>();
  const images: InlineEmailImage[] = [];
  const rewritten = html.replace(
    DATA_IMAGE_PATTERN,
    (_match, quote: string, source: string, mimeValue: string, payload: string) => {
      let image = imageBySource.get(source);
      if (!image) {
        const mimeType = mimeValue.toLocaleLowerCase("en") as InlineEmailImage["mimeType"];
        const index = images.length + 1;
        const filename = `mailflow-image-${index}.${extensionFor(mimeType)}`;
        image = {
          filename,
          contentId: `${filename}@potok.email`,
          mimeType,
          bytes: decodeBase64(payload),
        };
        imageBySource.set(source, image);
        images.push(image);
      }
      const value = reference === "cid" ? `cid:${image.contentId}` : image.filename;
      return `src=${quote}${value}${quote}`;
    },
  );
  return { html: rewritten, images };
}

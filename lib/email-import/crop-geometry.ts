export type ImageCrop = { x: number; y: number; width: number; height: number };
export const fullImageCrop: ImageCrop = { x: 0, y: 0, width: 100, height: 100 };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function normalizeImageCrop(crop: ImageCrop): ImageCrop {
  if (![crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)) return {...fullImageCrop};
  const width = clamp(crop.width, 0.1, 100), height = clamp(crop.height, 0.1, 100);
  return {x:clamp(crop.x,0,100-width),y:clamp(crop.y,0,100-height),width,height};
}
export function dragImageCrop(crop: ImageCrop, mode: string, dx: number, dy: number): ImageCrop {
  if (mode === "move") return {...crop, x:clamp(crop.x+dx,0,100-crop.width), y:clamp(crop.y+dy,0,100-crop.height)};
  const left = mode.includes("w") ? clamp(crop.x+dx,0,crop.x+crop.width-0.1) : crop.x;
  const top = mode.includes("n") ? clamp(crop.y+dy,0,crop.y+crop.height-0.1) : crop.y;
  const right = mode.includes("e") ? clamp(crop.x+crop.width+dx,left+0.1,100) : crop.x+crop.width;
  const bottom = mode.includes("s") ? clamp(crop.y+crop.height+dy,top+0.1,100) : crop.y+crop.height;
  return normalizeImageCrop({x:left,y:top,width:right-left,height:bottom-top});
}
export function imageCropPixels(crop: ImageCrop, width: number, height: number) {
  const c=normalizeImageCrop(crop), x=Math.round(width*c.x/100),y=Math.round(height*c.y/100);
  const right=Math.min(width,Math.round(width*(c.x+c.width)/100)),bottom=Math.min(height,Math.round(height*(c.y+c.height)/100));
  return {x,y,width:right-x,height:bottom-y};
}

import { forwardRef, type SVGProps, type ForwardRefExoticComponent, type RefAttributes } from "react";

export type PixelIconProps = SVGProps<SVGSVGElement> & { size?: string | number; absoluteStrokeWidth?: boolean };
export type PixelIcon = ForwardRefExoticComponent<PixelIconProps & RefAttributes<SVGSVGElement>>;
export function createPixelIcon(name: string, viewBox: string, paths: Array<{d: string; fillRule?: "evenodd"; clipRule?: "evenodd"}>): PixelIcon {
  const Icon = forwardRef<SVGSVGElement, PixelIconProps>(function RuneIcon({ size = 24, color = "currentColor", strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, children, ...props }, ref) {
    return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox={viewBox} fill="none" color={color} shapeRendering="crispEdges" focusable="false" aria-hidden={props["aria-label"] || props["aria-labelledby"] || props.role === "img" ? undefined : true} data-rune-icon={name} {...props}>{paths.map((path,index)=><path key={index} {...path} fill="currentColor" />)}{children}</svg>;
  });
  Icon.displayName = `Runeicon(${name})`;
  return Icon;
}

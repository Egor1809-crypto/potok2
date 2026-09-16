"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PresentationSlide } from "@/types/api";
import { findingRegions, type SlideFinding } from "@/lib/presentation-import/review-findings";
import styles from "./PresentationWorkshop.module.css";

export function AnnotatedSlide({slide,findings,active,onSelect,children}:{slide:PresentationSlide;findings:SlideFinding[];active:number|null;onSelect:(index:number)=>void;children:ReactNode}) {
  const frame=useRef<HTMLDivElement>(null);
  const [box,setBox]=useState({left:0,top:0,width:0,height:0});
  useLayoutEffect(()=>{
    const root=frame.current;
    const canvas=root?.querySelector<HTMLElement>("[data-presentation-canvas]") || root?.firstElementChild as HTMLElement;
    if(!root || !canvas)return;
    const measure=()=>{const r=root.getBoundingClientRect(),c=canvas.getBoundingClientRect();setBox({left:c.left-r.left,top:c.top-r.top,width:c.width,height:c.height});};
    measure();const observer=new ResizeObserver(measure);observer.observe(root);observer.observe(canvas);
    return()=>observer.disconnect();
  },[slide]);
  const regions=findings.map(f=>findingRegions(f,slide));
  const positions:{x:number;y:number}[]=[];
  return <div ref={frame} className={styles.annotatedFrame}>
    {children}
    {box.width>0 && findings.length>0 && <div className={styles.annotationLayer} style={box} aria-label="Замечания на слайде">
      {findings.map((f,i)=>{
        const r=regions[i][0];
        let x=r ? r.x*box.width/100 : 20+i*40,y=r ? r.y*box.height/100 : 20;
        x=Math.max(20,Math.min(box.width-20,x));y=Math.max(20,Math.min(box.height-20,y));
        for(let attempt=0;attempt<12 && positions.some(p=>Math.hypot(p.x-x,p.y-y)<38);attempt++){
          if(x+40<box.width-20)x+=40;else {x=20;y=Math.min(box.height-20,y+40);}
        }
        positions.push({x,y});
        return <div key={i} data-priority={f.priority} data-active={active===i} className={styles.annotation}>
          {regions[i].map((area,n)=><div key={n} aria-hidden className={styles.annotationRegion} style={{left:`${area.x}%`,top:`${area.y}%`,width:`${area.width}%`,height:`${area.height}%`}}/>)}
          <button type="button" className={styles.annotationPin} style={{left:x,top:y}} aria-label={`Замечание ${i+1}: ${f.title}${r?"":" — весь слайд"}`} aria-pressed={active===i} title={`${i+1}. ${f.title}${r?"":" · Весь слайд"}`} onClick={()=>onSelect(i)}>{i+1}</button>
        </div>;
      })}
    </div>}
  </div>;
}

import type { PresentationProjectRecord, PresentationSlide } from "@/types/api";
import type { SlideDirection } from "./direction";
import { slideFingerprint, type SlideReview } from "./review";
import { finalizeRevision, type SlideChange } from "./revision";
import { runSlideReviews } from "./review-queue";
export type CorrectionResult = {status:"changed"|"manual"|"clean";slide:PresentationSlide;changes:SlideChange[];notes:string[]};
/** Each slide is a separate transaction. A failure never discards other completed changes. */
export async function correctPresentation(options:{
  project:PresentationProjectRecord;reviews:Record<string,SlideReview>;ids?:string[];signal:AbortSignal;
  capture:(slide:PresentationSlide,signal:AbortSignal)=>Promise<string>;
  review:(slide:PresentationSlide,image:string,number:number,signal:AbortSignal)=>Promise<SlideDirection>;
  revise:(slide:PresentationSlide,review:SlideDirection,number:number,signal:AbortSignal)=>Promise<SlideDirection>;
  onReviewed:(slide:PresentationSlide,review:SlideReview)=>void;
  onResult:(slide:PresentationSlide,result:CorrectionResult)=>void;
  onError:(slide:PresentationSlide,error:unknown)=>void;
  onActive:(ids:string[])=>void;isFatal:(error:unknown)=>boolean;
}) {
  const project=structuredClone(options.project);
  const existing=(slide:PresentationSlide)=>{const report=options.reviews[slide.id];return report?.fingerprint===slideFingerprint(project,slide)?report.direction:undefined;};
  await runSlideReviews({items:project.slides.map((slide,i)=>({slide,number:i+1})).filter(item=>!options.ids || options.ids.includes(item.slide.id)),signal:options.signal,concurrency:3,
    capture:async(item,signal)=>existing(item.slide)?undefined:options.capture(item.slide,signal),
    review:async(item,image,signal)=>{
      const {slide,number}=item;
      const review=existing(slide) || await options.review(slide,image!,number,signal);
      signal.throwIfAborted();
      options.onReviewed(slide,{fingerprint:slideFingerprint(project,slide),direction:review});
      if(!review.findings.length)return {status:"clean" as const,slide,changes:[],notes:["В разборе нет замечаний."]};
      if(slide.canvas?.elements.length && slide.canvas.elements.every(e=>e.locked))return {status:"manual" as const,slide,changes:[],notes:["Все элементы заблокированы. Снимите блокировку в редакторе."]};
      const direction=await options.revise(slide,review,number,signal);
      signal.throwIfAborted();
      // Validate the patches again at the application boundary. Never trust a claimed success.
      const result=finalizeRevision(slide,direction,true);
      return {status:result.changes.length?"changed" as const:"manual" as const,slide:result.proposed,changes:result.changes,notes:result.direction.findings};
    },onResult:(item,result)=>options.onResult(item.slide,result),onError:(item,error)=>options.onError(item.slide,error),onActive:items=>options.onActive(items.map(i=>i.slide.id)),isFatal:options.isFatal});
}

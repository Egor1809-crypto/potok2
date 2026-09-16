import type { PresentationSlide } from "@/types/api";
import { applySlideDirection, type SlideDirection } from "./direction";
import type { SlideFinding } from "./review-findings";
export type SlideChange = { target: string; label: string; field: string; before: string; after: string };
export const changeLabels: Record<string,string> = {text:"Текст",title:"Заголовок",body:"Основной текст",eyebrow:"Подпись",bullets:"Список",fontSize:"Размер шрифта",color:"Цвет текста",fill:"Заливка",backgroundColor:"Фон",textColor:"Цвет текста",accentColor:"Акцент",bold:"Полужирный",italic:"Курсив",align:"Выравнивание",x:"Положение по горизонтали",y:"Положение по вертикали",width:"Ширина",height:"Высота"};
const defaults: Record<string,unknown> = {fontSize:24,color:"#111111",fill:"transparent",bold:false,italic:false,align:"left",backgroundColor:"#ffffff"};
const printable=(v:unknown)=> v===undefined ? "По теме" : Array.isArray(v)?v.join(" · "):String(v);
const same=(a:unknown,b:unknown)=>typeof a==="string"&&typeof b==="string"&&/^#[\da-f]{6}$/i.test(a)&&/^#[\da-f]{6}$/i.test(b)?a.toLowerCase()===b.toLowerCase():JSON.stringify(a)===JSON.stringify(b);
/** Actual editable differences, never a model's claim that it changed something. */
export function revisionChanges(before:PresentationSlide,after:PresentationSlide):SlideChange[] {
  const changes:SlideChange[]=[];
  const add=(target:string,label:string,a:Record<string,unknown>,b:Record<string,unknown>,fields:string[])=>{
    for(const field of fields){const old=a[field]??defaults[field],next=b[field]??defaults[field];if(!same(old,next))changes.push({target,label,field,before:printable(old),after:printable(next)});}
  };
  add("slide","Слайд",before as unknown as Record<string,unknown>,after as unknown as Record<string,unknown>,before.canvas?["backgroundColor"]:["title","body","eyebrow","bullets","backgroundColor","textColor","accentColor"]);
  for(const element of before.canvas?.elements??[]){const next=after.canvas?.elements.find(e=>e.id===element.id);if(!next)throw Error("Правки не могут удалять элементы.");add(element.id,element.kind==="text"?(element.text||"Текст").slice(0,80):element.kind==="image"?"Изображение":"Фигура",element as unknown as Record<string,unknown>,next as unknown as Record<string,unknown>,["x","y","width","height",...(element.kind==="text"?["text","fontSize","color","fill","bold","italic","align"]:element.kind==="shape"?["fill"]:[])]);}
  return changes;
}
export function finalizeRevision(slide:PresentationSlide,direction:SlideDirection,preserveNumbers=false) {
  const proposed=applySlideDirection(slide,direction);
  if(preserveNumbers){
    const numbers=(s:PresentationSlide)=>((s.canvas?s.canvas.elements.filter(e=>e.kind==="text").map(e=>e.text).join(" "):[s.title,s.eyebrow,s.body,...s.bullets].join(" ")).match(/\d+(?:[.,:/-]\d+)*/g)??[]).sort().join("|");
    if(numbers(slide)!==numbers(proposed))throw Error("Автоматическая правка меняет числа или даты. Нужна проверка автора.");
  }
  const changes=revisionChanges(slide,proposed);
  const keys=new Set(changes.map(c=>`${c.target}:${c.field}`));
  const patches=direction.patches.filter(p=>keys.has(`${p.target}:${p.field}`));
  const summary=changes.length?`Изменений: ${changes.length}. ${[...new Set(changes.map(c=>changeLabels[c.field]||c.field))].join(", ")}.`:"Слайд не изменён. Автоматические правки не подготовлены.";
  return {proposed:changes.length?proposed:structuredClone(slide),changes,direction:{...direction,patches,summary,findings:changes.length?direction.findings:direction.findings.length?direction.findings:["Не найдено применимых изменений. Уточните конкретный пункт или отредактируйте слайд вручную."]}};
}
function luminance(hex:string){const rgb=hex.slice(1).match(/../g)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
/** Deterministic contrast repair only on a known solid background and explicitly named text. */
export function mechanicalCorrections(slide:PresentationSlide,findings:SlideFinding[],background="#ffffff") {
  const patches:SlideDirection["patches"]=[],remaining:number[]=[];
  const c=slide.canvas;
  findings.forEach((f,index)=>{
    if(!c || !f.elementIds.length || !/контраст|слива[ею]|бледн/i.test(`${f.title} ${f.problem}`) || !/цвет|контраст|темн|тёмн|светл|затемн/i.test(f.suggestion) || /шрифт|кегл|размер|переме|увелич|источник|уточн|добав|напиш/i.test(f.suggestion)){remaining.push(index);return;}
    const planned:SlideDirection["patches"]=[];
    for(const id of f.elementIds){
      const at=c.elements.findIndex(e=>e.id===id),e=c.elements[at];
      if(!e||e.kind!=="text"||e.locked){remaining.push(index);return;}
      if(c.elements.slice(at+1).some(above=>(above.kind==="image" || (above.fill && above.fill!=="transparent")) && above.x<e.x+e.width && above.x+above.width>e.x && above.y<e.y+e.height && above.y+above.height>e.y)){remaining.push(index);return;}
      let bg=slide.backgroundColor||background;
      for(const below of c.elements.slice(0,at)){
        const overlaps=below.x<e.x+e.width&&below.x+below.width>e.x&&below.y<e.y+e.height&&below.y+below.height>e.y;
        if(!overlaps)continue;
        if(below.kind==="image"||below.rotation){bg="unknown";continue;}
        if(below.fill&&below.fill!=="transparent")bg=below.x<=e.x&&below.y<=e.y&&below.x+below.width>=e.x+e.width&&below.y+below.height>=e.y+e.height?below.fill:"unknown";
      }
      if(e.fill&&e.fill!=="transparent")bg=e.fill;
      const color=e.color||"#111111";
      if(!/^#[\da-f]{6}$/i.test(bg)||!/^#[\da-f]{6}$/i.test(color)||contrast(color,bg)>=4.5){remaining.push(index);return;}
      const next=contrast("#222222",bg)>=4.5?"#222222":"#ffffff";
      if(contrast(next,bg)<4.5){remaining.push(index);return;}
      planned.push({target:id,field:"color",value:next});
    }
    patches.push(...planned);
  });
  return {patches:[...new Map(patches.map(p=>[`${p.target}:${p.field}`,p])).values()],remaining:[...new Set(remaining)]};
}

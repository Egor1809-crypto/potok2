import { changeLabels, type SlideChange } from "@/lib/presentation-import/revision";
import styles from "./PresentationWorkshop.module.css";
const value=(text:string)=>text==="true"?"Да":text==="false"?"Нет":text==="left"?"Слева":text==="center"?"По центру":text==="right"?"Справа":text;
export function RevisionChanges({changes}:{changes:SlideChange[]}) {
  return <ul className={styles.changeList} aria-label="Фактические изменения">{changes.map((c,i)=><li key={i}>
    <strong>{changeLabels[c.field]||c.field}</strong><span className={styles.changeTarget}>{c.label}</span>
    <div><span aria-label="Было">{value(c.before)}</span><span aria-hidden> → </span><span aria-label="Стало">{value(c.after)}</span></div>
  </li>)}</ul>;
}

"use client";
import type { AiEmailReview } from "@/types/email-ai";

export function EmailReviewReport({ review, current, onSelectBlock, onFix }: { review: AiEmailReview; current: boolean; onSelectBlock: (id: string) => void; onFix: (id: string | undefined, instruction: string) => void }) {
  if (!current) return <div className="mt-5 rounded-xl border border-border p-3 text-sm leading-6 text-text-muted">{review.rubricVersion ? "Письмо изменилось после проверки. Проверьте текущую версию, чтобы обновить замечания." : "Для этого письма сохранена прежняя оценка. Нажмите «Проверить письмо», чтобы получить разбор по конкретным критериям."}</div>;
  const editor = review.issues.filter(i => i.source === "editor");
  return <section className="mt-5 space-y-4 border-t border-border pt-4" aria-label="Проверка арт-директора">
    <div><h4 className="m-0 text-sm font-semibold">{review.score === null ? "Добавьте содержимое для оценки" : `Проверка макета: ${review.score}/100`}</h4><p className="mt-1 text-sm leading-5 text-text-muted">Баллы считаются по правилам ниже. Редакторские рекомендации не меняют оценку.</p></div>
    <details className="rounded-xl border border-border p-3" open={review.checks?.some(c => c.status === "fail")}>
      <summary className="cursor-pointer text-sm font-medium">Критерии и расчёт</summary>
      <ul className="m-0 mt-3 grid list-none gap-3 p-0">{review.checks?.map(check => <li key={check.id} className="text-sm leading-5">
        <div className="flex items-baseline justify-between gap-2 font-medium"><span>{check.title}</span><span className="shrink-0 tabular-nums">{check.status === "not_checked" ? "Не проверено" : `${check.points}/${check.maximum}`}</span></div>
        <p className="m-0 mt-1 text-text-muted">{check.detail}</p>
      </li>)}</ul>
    </details>
    {review.issues.filter(i => i.source === "rule").map((issue, i) => <div key={i} className="rounded-lg bg-surface-subtle p-3 text-sm leading-5"><p className="m-0">{issue.message}</p>{issue.blockId ? <button type="button" className="mt-2 text-accent underline underline-offset-4" onClick={() => onSelectBlock(issue.blockId!)}>Выбрать блок</button> : null}</div>)}
    <div><h4 className="m-0 text-sm font-semibold">Редакторские рекомендации</h4>{review.unavailable ? <p className="text-sm leading-5 text-text-muted">ИИ-редактор сейчас недоступен. Автоматические проверки выполнены; редактуру можно повторить позже.</p> : !editor.length ? <p className="text-sm leading-5 text-text-muted">Редактор не нашёл замечаний, которые смог подтвердить цитатой из письма.</p> : null}</div>
    {editor.map((issue, i) => <article key={i} className="rounded-xl border border-border p-3 text-sm leading-5">
      <blockquote className="m-0 border-l-2 border-border pl-3 text-text-muted">«{issue.evidence}»</blockquote><p>{issue.message}</p><p className="text-text-muted">{issue.suggestion}</p>
      <button type="button" className="text-accent underline underline-offset-4" onClick={() => onFix(issue.blockId, `${issue.suggestion} Сохрани факты, ссылки и остальные элементы.`)}>Подготовить правку</button>
    </article>)}
  </section>;
}

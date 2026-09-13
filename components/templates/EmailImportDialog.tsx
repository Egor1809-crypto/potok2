"use client";

import { useRef, useState } from "react";
import { Code2, Upload } from "@/components/ui/icons";
import { Alert, Button, FormField, Modal, Select, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@/components/ui";
import { importAccept } from "@/lib/email-import/formats";
import { MAX_HTML_CODE_LENGTH, type CodeImportInput, type CodeImportMode } from "@/lib/email-import/code";

export function EmailImportDialog({ open, onOpenChange, busy, progress, error, onFiles, onCode }: {
  open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; progress: string; error: string | null;
  onFiles: (files: File[]) => void; onCode: (input: CodeImportInput) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("file");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<CodeImportMode>("auto");
  const [instructions, setInstructions] = useState("");
  const [resources, setResources] = useState<File[]>([]);
  return <Modal open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }} title="Импортировать письмо" size="xl" closeOnEscape={!busy} closeOnBackdrop={!busy}
    footer={<div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Отмена</Button>{tab === "code" ? <Button loading={busy} disabled={busy || !code.trim()} onClick={() => onCode({ code, mode, instructions: mode === "html" ? "" : instructions, resources })}>Произвести письмо</Button> : null}</div>}>
    <div className="min-w-0 space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Tabs value={tab} onValueChange={value => { if (!busy) setTab(value); }}>
        <TabsList aria-label="Способ импорта письма"><TabsTrigger value="file" disabled={busy}><Upload className="mr-2 size-6" aria-hidden="true" />Из файла</TabsTrigger><TabsTrigger value="code" disabled={busy}><Code2 className="mr-2 size-6" aria-hidden="true" />Вставить код</TabsTrigger></TabsList>
        <TabsContent value="file" className="space-y-4 pt-4">
          <p className="text-sm leading-6 text-text-muted">HTML, PDF, Word DOCX, изображения, TXT и JSON Поток. Вместе с HTML можно выбрать его изображения и CSS.</p>
          <input ref={fileInput} type="file" multiple accept={importAccept} hidden disabled={busy} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onFiles(files); }} />
          <Button variant="secondary" disabled={busy} loading={busy} onClick={() => fileInput.current?.click()}>Выбрать файл письма</Button>
        </TabsContent>
        <TabsContent value="code" className="min-w-0 space-y-4 pt-4">
          <FormField label="Обработка кода" htmlFor="letter-code-mode"><Select id="letter-code-mode" value={mode} disabled={busy} onChange={event => setMode(event.target.value as CodeImportMode)} options={[{ value: "auto", label: "Определить автоматически" }, { value: "html", label: "HTML без изменений" }, { value: "ai", label: "Преобразовать с ИИ" }]} /></FormField>
          <p className="text-sm leading-6 text-text-muted">HTML сохранится с исходным оформлением. JSX, MJML, Markdown, JavaScript, Python и другой код ИИ преобразует в статичное письмо. Динамические функции не запускаются.</p>
          <FormField label="Код письма" htmlFor="letter-source-code" hint="Можно вставить полный документ или фрагмент.">
            <Textarea id="letter-source-code" value={code} onChange={event => setCode(event.target.value)} disabled={busy} maxLength={MAX_HTML_CODE_LENGTH} spellCheck={false} autoCapitalize="off" autoCorrect="off" rows={12} className="min-w-0 resize-y font-mono text-sm leading-6" placeholder={'<table style="width:100%;max-width:620px">\n  <tr><td>Содержимое письма</td></tr>\n</table>'} />
          </FormField>
          {mode !== "html" ? <FormField label="Что должно получиться" htmlFor="letter-code-instructions" hint="Необязательно. Пожелания включат обработку с ИИ, даже если вы вставили HTML."><Textarea id="letter-code-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} disabled={busy} maxLength={2000} rows={2} placeholder="Например: сохранить текст и цвета, а форму заменить ссылкой на регистрацию." /></FormField> : null}
          <FormField label="Изображения и CSS из кода" htmlFor="letter-code-resources" hint="При необходимости приложите файлы, указанные в относительных путях."><input id="letter-code-resources" type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.css" disabled={busy} className="block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-subtle file:px-3 file:py-2" onChange={event => setResources(Array.from(event.target.files ?? []))} /></FormField>
          {resources.length ? <p className="break-words text-xs leading-5 text-text-muted">Приложены: {resources.map(file => file.name).join(", ")}</p> : null}
        </TabsContent>
      </Tabs>
      {progress ? <p role="status" aria-live="polite" className="text-sm text-primary">{progress}</p> : null}
    </div>
  </Modal>;
}

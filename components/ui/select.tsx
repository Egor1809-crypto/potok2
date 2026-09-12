"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./utils";

export interface SelectOption { label: string; value: string; disabled?: boolean }
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children" | "multiple" | "size"> {
  options?: SelectOption[];
  placeholder?: string;
  children?: React.ReactNode;
  wrapperClassName?: string;
}
function labelText(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? labelText(child.props.children) : String(child)).join("");
}
function readOptions(children: React.ReactNode, disabled = false): SelectOption[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(child)) return [];
    if (child.type === "option") return [{ label: labelText(child.props.children), value: String(child.props.value ?? labelText(child.props.children)), disabled: disabled || child.props.disabled }];
    return readOptions(child.props.children, disabled || child.props.disabled);
  });
}

// Keep a native form control for FormData, validation, refs and React change events.
// Only the branded button and listbox are exposed to the user.
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, children, className, wrapperClassName, id, value, defaultValue, disabled, onChange, onKeyDown, onFocus, onBlur, ...props }, ref,
) {
  const uid = React.useId();
  const listId = `${uid}-options`;
  const trigger = React.useRef<HTMLButtonElement>(null);
  const native = React.useRef<HTMLSelectElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => native.current!, []);
  const entries = React.useMemo(() => [
    ...(placeholder ? [{ value: "", label: placeholder, disabled: true }] : []),
    ...(children !== undefined ? readOptions(children) : options ?? []),
  ], [children, options, placeholder]);
  const [uncontrolled, setUncontrolled] = React.useState(String(defaultValue ?? entries.find(entry => !entry.disabled)?.value ?? ""));
  const selected = String(value ?? uncontrolled);
  const selectedIndex = entries.findIndex(entry => entry.value === selected);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [invalid, setInvalid] = React.useState(false);
  const [position, setPosition] = React.useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const typeahead = React.useRef({ text: "", at: 0 });
  const enabled = entries.map((entry, index) => entry.disabled ? -1 : index).filter(index => index >= 0);
  function close() { setOpen(false); }
  function show() { if (!disabled && !trigger.current?.matches(":disabled")) { setActive(selectedIndex >= 0 && !entries[selectedIndex].disabled ? selectedIndex : enabled[0] ?? -1); setOpen(true); } }
  function choose(index: number) {
    if (!entries[index] || entries[index].disabled || !native.current) return;
    native.current.value = entries[index].value;
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    setUncontrolled(entries[index].value); setInvalid(false); close(); trigger.current?.focus();
  }
  React.useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
      const below = window.innerHeight - rect.bottom - 16, above = rect.top - 16;
      const openBelow = below >= Math.min(240, above);
      const height = Math.min(320, openBelow ? below : above);
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24);
      setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: openBelow ? rect.bottom + 6 : Math.max(12, rect.top - Math.min(height, entries.length * 40 + 8) - 6), maxHeight: Math.max(80, height) });
    }
    place();
    function outside(event: PointerEvent) { if (!trigger.current?.contains(event.target as Node) && !list.current?.contains(event.target as Node)) close(); }
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true); document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); document.removeEventListener("pointerdown", outside); };
  }, [open, entries.length]);
  React.useEffect(() => { if (open) list.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  React.useEffect(() => {
    const form = native.current?.form;
    const reset = () => { setUncontrolled(String(defaultValue ?? entries.find(entry => !entry.disabled)?.value ?? "")); setInvalid(false); close(); };
    form?.addEventListener("reset", reset); return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, entries]);

  return <div className={cn("relative min-w-0", wrapperClassName)}>
    <button ref={trigger} id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && active >= 0 ? `${uid}-${active}` : undefined}
      aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} aria-invalid={invalid || props["aria-invalid"]} aria-required={props.required} disabled={disabled} tabIndex={0}
      className={cn("input flex min-w-0 max-w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/30", className)}
      onClick={() => open ? close() : show()}
      onFocus={event => onFocus?.(event as unknown as React.FocusEvent<HTMLSelectElement>)}
      onBlur={event => { close(); onBlur?.(event as unknown as React.FocusEvent<HTMLSelectElement>); }}
      onKeyDown={event => {
        onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLSelectElement>); if (event.defaultPrevented) return;
        if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (event.key === "Tab") { close(); return; }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (!open) { show(); if (event.key === "End") setActive(enabled.at(-1) ?? -1); return; }
          const offset = enabled.indexOf(active);
          setActive(event.key === "Home" ? enabled[0] ?? -1 : event.key === "End" ? enabled.at(-1) ?? -1 : enabled[(offset + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length] ?? -1); return;
        }
        if (event.key === "Enter" || (event.key === " " && (!typeahead.current.text || Date.now() - typeahead.current.at >= 700))) { event.preventDefault(); if (open) choose(active); else show(); return; }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault(); const now = Date.now(); const previous = now - typeahead.current.at < 700 ? typeahead.current.text : "";
          const text = (previous + event.key).toLocaleLowerCase("ru"); typeahead.current = { text, at: now };
          const match = enabled.find(index => entries[index].label.toLocaleLowerCase("ru").startsWith(text));
          if (!open) show(); if (match !== undefined) setActive(match);
        }
      }}><span className="min-w-0 truncate">{entries[selectedIndex]?.label ?? placeholder ?? "Выберите…"}</span><ChevronDown aria-hidden className={cn("size-4 shrink-0 text-text-muted", open && "rotate-180")} /></button>
    <select {...props} ref={native} value={value} defaultValue={defaultValue} disabled={disabled} aria-hidden="true" tabIndex={-1} className="sr-only pointer-events-none" onFocus={() => trigger.current?.focus()}
      onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); props.onInvalid?.(event); }}
      onChange={event => { setUncontrolled(event.currentTarget.value); setInvalid(false); onChange?.(event); }}>
      {entries.map((entry, index) => <option key={`${entry.value}:${index}`} value={entry.value} disabled={entry.disabled}>{entry.label}</option>)}
    </select>
    {open && position && createPortal(<div ref={list} id={listId} role="listbox" tabIndex={-1} aria-label={props["aria-label"] ?? "Варианты"} className="fixed z-[1500] overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-raised p-1 shadow-[var(--shadow-lg)]" style={position} onMouseDown={event => event.preventDefault()}>
      {entries.map((entry, index) => <div key={`${entry.value}:${index}`} id={`${uid}-${index}`} data-option-index={index} role="option" tabIndex={-1} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(index); } }} aria-selected={entry.value === selected} aria-disabled={entry.disabled || undefined}
        className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm [overflow-wrap:anywhere]", index === active ? "bg-primary-subtle text-primary" : "text-text-strong", entry.disabled && "cursor-not-allowed opacity-40")}
        onMouseMove={() => { if (!entry.disabled) setActive(index); }} onClick={() => choose(index)}><span className="min-w-0 flex-1">{entry.label}</span>{entry.value === selected && <Check aria-hidden className="size-4 shrink-0 text-primary" />}</div>)}
    </div>, document.body)}
  </div>;
});
export { Select as NativeSelect };

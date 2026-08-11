"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { workspaceConfig } from "@/config/brand";

export type WorkspaceOption = {
  id: string;
  name: string;
  plan?: string;
  initials?: string;
};

type WorkspaceSwitcherProps = {
  collapsed?: boolean;
  workspaces?: WorkspaceOption[];
  value?: string;
  onValueChange?: (workspaceId: string) => void;
};

const defaultWorkspaces: WorkspaceOption[] = [
  {
    id: workspaceConfig.id,
    name: workspaceConfig.name,
    plan: workspaceConfig.plan,
    initials: "ЮК",
  },
  {
    id: "workspace-events",
    name: "Мероприятия и связи с общественностью",
    plan: "Профессиональный",
    initials: "МС",
  },
];

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function WorkspaceSwitcher({
  collapsed = false,
  workspaces = defaultWorkspaces,
  value,
  onValueChange,
}: WorkspaceSwitcherProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    value ?? workspaces[0]?.id ?? "",
  );
  const selectedId = value ?? internalValue;
  const selected =
    workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectWorkspace = (workspaceId: string) => {
    setInternalValue(workspaceId);
    onValueChange?.(workspaceId);
    setOpen(false);
  };

  if (!selected) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="listbox"
        aria-label={collapsed ? `Рабочее пространство: ${selected.name}` : undefined}
        title={collapsed ? selected.name : undefined}
        onClick={() => setOpen((current) => !current)}
        className={
          collapsed
            ? "group grid size-10 place-items-center rounded-xl border border-border bg-surface text-xs font-semibold text-text-muted shadow-sm outline-none transition hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary/40"
            : "group flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-left shadow-sm outline-none transition hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-primary/40"
        }
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-subtle text-[10px] font-bold tracking-wide text-primary">
          {selected.initials ?? initialsFor(selected.name)}
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-text-strong">
                {selected.name}
              </span>
              <span className="block truncate text-[11px] text-text-muted">
                {selected.plan ? `Тариф ${selected.plan}` : "Рабочее пространство"}
              </span>
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="size-3.5 text-text-subtle transition group-hover:text-text-muted"
            />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Выбор рабочего пространства"
          className={
            collapsed
              ? "absolute left-full top-0 z-50 ml-2 w-64 origin-top-left rounded-xl border border-border bg-surface p-1.5 shadow-[0_16px_48px_rgba(15,23,42,0.14)]"
              : "absolute inset-x-0 top-full z-50 mt-2 origin-top rounded-xl border border-border bg-surface p-1.5 shadow-[0_16px_48px_rgba(15,23,42,0.14)]"
          }
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Рабочие пространства
          </p>
          {workspaces.map((workspace) => {
            const isSelected = workspace.id === selected.id;
            return (
              <button
                key={workspace.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectWorkspace(workspace.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none transition hover:bg-surface-subtle focus-visible:bg-primary-subtle"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-subtle text-[10px] font-bold text-text-muted">
                  {workspace.initials ?? initialsFor(workspace.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text-strong">
                    {workspace.name}
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    {workspace.plan ? `Тариф ${workspace.plan}` : "Рабочее пространство"}
                  </span>
                </span>
                {isSelected ? (
                  <Check aria-hidden="true" className="size-4 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

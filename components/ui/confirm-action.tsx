"use client";
import { createRoot } from "react-dom/client";
import { Modal } from "./modal";
import { Button } from "./button";

let pending: Promise<boolean> | null = null;
/** Branded confirmation for destructive actions; ordinary navigation needs no dialog. */
export function confirmAction(message: string): Promise<boolean> {
  if (pending) return Promise.resolve(false);
  pending = new Promise<boolean>(resolve => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (accepted: boolean) => {
      root.unmount(); host.remove(); pending = null; resolve(accepted);
    };
    root.render(<Modal open onOpenChange={() => finish(false)} title="Подтвердите действие" size="md" footer={<><Button variant="secondary" data-autofocus onClick={() => finish(false)}>Отмена</Button><Button onClick={() => finish(true)}>Подтвердить</Button></>}><p className="text-sm leading-6">{message}</p></Modal>);
  });
  return pending;
}

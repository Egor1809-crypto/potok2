"use client";

import { Modal, type ModalProps } from "@/components/ui/modal";
import { cn } from "@/components/ui/utils";
import styles from "./Director.module.css";

/** The same editing session can live in the shared workspace or a contextual dialog. */
export function DirectorFrame({ embedded, children, footer, contentClassName, ...props }: ModalProps & { embedded?: boolean }) {
  if (!embedded) return <Modal {...props} footer={footer} contentClassName={contentClassName}>{children}</Modal>;
  return <section className={styles.frame} aria-label={typeof props.title === "string" ? props.title : "Рабочая область"}>
    <div className={cn(styles.body, contentClassName)}>{children}</div>
    {footer && <footer className={styles.footer}>{footer}</footer>}
  </section>;
}

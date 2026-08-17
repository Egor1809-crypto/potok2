"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleHelp, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type GuideStep = {
  id: string;
  title: string;
  text: string;
  href: string;
  target: string;
};

const GUIDE_KEY = "potok-product-guide-dismissed-v1";

const steps: GuideStep[] = [
  {
    id: "templates",
    title: "1. Начните с шаблона",
    text: "Выберите готовую основу или создайте своё письмо в конструкторе. Ничего не отправится, пока Вы не запустите кампанию.",
    href: "/templates?scope=mine",
    target: "[data-guide-id='templates']",
  },
  {
    id: "contacts",
    title: "2. Загрузите аудиторию",
    text: "Каждый загруженный файл становится отдельным листом базы. Согласие на email берётся из столбца файла или подтверждается один раз для всей загрузки.",
    href: "/contacts",
    target: "[data-guide-id='contacts']",
  },
  {
    id: "integrations",
    title: "3. Подключите канал",
    text: "В настройках подключения добавьте UniSender для email или Telegram-бота для сообщений. Здесь же проверяется адрес отправителя.",
    href: "/integrations",
    target: "[data-guide-id='integrations']",
  },
  {
    id: "campaigns",
    title: "4. Соберите и проверьте кампанию",
    text: "Выберите шаблон, конкретный лист контактов и канал. Перед запуском сервис покажет, что именно ещё нужно исправить.",
    href: "/campaigns",
    target: "[data-guide-id='campaigns']",
  },
];

export function ProductGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [seenInitialState, setSeenInitialState] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(GUIDE_KEY) === "true";
    const frame = window.requestAnimationFrame(() => {
      if (!dismissed) setOpen(true);
      setSeenInitialState(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const currentStep = steps[stepIndex] ?? steps[0];
  const targetExists = Boolean(pathname && open && seenInitialState && document.querySelector(currentStep.target));

  useEffect(() => {
    if (!open || !targetExists) return;
    const node = document.querySelector(currentStep.target) as HTMLElement | null;
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.setAttribute("data-guide-active", "true");
    return () => node.removeAttribute("data-guide-active");
  }, [currentStep.target, open, targetExists]);

  const close = () => {
    window.localStorage.setItem(GUIDE_KEY, "true");
    setOpen(false);
  };

  const goNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      close();
      return;
    }
    setStepIndex(nextIndex);
    router.push(steps[nextIndex].href);
  };

  const restart = () => {
    window.localStorage.removeItem(GUIDE_KEY);
    setStepIndex(0);
    setOpen(true);
    router.push(steps[0].href);
  };

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={restart}
          className="fixed bottom-5 right-5 z-40 inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(101,88,232,0.32)] outline-none transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(101,88,232,0.4)] focus-visible:ring-4 focus-visible:ring-primary/25"
          aria-label="Открыть быстрый старт"
        >
          <CircleHelp aria-hidden="true" className="size-5" />
        </button>
      ) : null}

      {open ? (
        <div className="pointer-events-none fixed inset-0 z-50" aria-live="polite">
          <div className="absolute inset-0 bg-slate-950/18" />
          <section className="pointer-events-auto absolute bottom-4 left-4 right-4 mx-auto max-w-[440px] rounded-2xl border border-border bg-surface p-5 shadow-[0_22px_65px_rgba(15,23,42,0.22)] sm:bottom-6 sm:left-auto sm:right-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary">
                <Sparkles aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Быстрый старт · {stepIndex + 1}/{steps.length}</p>
                <h2 className="mt-1 text-base font-semibold tracking-[-0.015em] text-text-strong">{currentStep.title}</h2>
              </div>
              <button type="button" onClick={close} className="grid size-8 place-items-center rounded-lg text-text-subtle transition hover:bg-surface-subtle hover:text-text-strong" aria-label="Закрыть обучение">
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-text-muted">{currentStep.text}</p>
            {!targetExists ? <p className="mt-2 text-[11px] leading-4 text-text-subtle">Открываю нужный раздел — нажмите «Дальше», чтобы продолжить маршрут.</p> : null}
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" onClick={close} className="text-[12px] font-medium text-text-muted underline-offset-4 transition hover:text-text-strong hover:underline">Пройти позже</button>
              <Button type="button" size="sm" onClick={goNext}>{stepIndex + 1 === steps.length ? "Готово" : "Дальше"}</Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

"use client";

import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  CheckCircle2,
  CircleDashed,
  Download,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageCircleMore,
  MessagesSquare,
  Route,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, Badge, Button, Modal } from "@/components/ui";
import { contacts } from "@/data/mockContacts";
import {
  deliveryChannelById,
  deliveryChannels,
  getProvidersForChannel,
  integrationProviderById,
  INTEGRATION_DEMO_ROUTES_STORAGE_KEY,
  type DeliveryChannelId,
  type IntegrationProviderDefinition,
  type IntegrationProviderId,
} from "@/config/integrations";

const channelIcons = {
  email: Mail,
  telegram: MessageCircleMore,
  vk: MessagesSquare,
} satisfies Record<DeliveryChannelId, typeof Mail>;

type DemoRoutes = Record<DeliveryChannelId, IntegrationProviderId | null>;

type ChannelProviderSelection = {
  channelId: DeliveryChannelId;
  providerId: IntegrationProviderId;
};

type ChannelProviderKey =
  `${DeliveryChannelId}:${IntegrationProviderId}`;

const emptyDemoRoutes: DemoRoutes = {
  email: null,
  telegram: null,
  vk: null,
};

function parseDemoRoutesSnapshot(snapshot: string | null): DemoRoutes {
  if (!snapshot) return emptyDemoRoutes;
  try {
    const value = JSON.parse(snapshot) as Partial<DemoRoutes>;
    return Object.fromEntries(
      deliveryChannels.map((channel) => {
        const providerId = value[channel.id];
        const validProvider = providerId
          ? integrationProviderById[providerId]
          : null;
        return [
          channel.id,
          validProvider?.channelIds.includes(channel.id) ? providerId : null,
        ];
      }),
    ) as DemoRoutes;
  } catch {
    return emptyDemoRoutes;
  }
}

function getChannelProviderKey(
  channelId: DeliveryChannelId,
  providerId: IntegrationProviderId,
): ChannelProviderKey {
  return `${channelId}:${providerId}`;
}

export function IntegrationsView() {
  const [activeChannelId, setActiveChannelId] =
    useState<DeliveryChannelId>("email");
  const [selectedSetup, setSelectedSetup] =
    useState<ChannelProviderSelection | null>(null);
  const [draftProviderKeys, setDraftProviderKeys] = useState<
    Set<ChannelProviderKey>
  >(() => new Set());
  const [demoRoutes, setDemoRoutes] =
    useState<DemoRoutes>(emptyDemoRoutes);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const activeChannel = deliveryChannelById[activeChannelId];
  const providers = useMemo(
    () => getProvidersForChannel(activeChannelId),
    [activeChannelId],
  );
  const selectedProvider = selectedSetup
    ? integrationProviderById[selectedSetup.providerId]
    : null;
  const selectedChannelId = selectedSetup?.channelId ?? activeChannelId;
  const configuredDemoRoutes = Object.values(demoRoutes).filter(Boolean).length;

  useEffect(() => {
    let frame = 0;
    try {
      const storedRoutes = parseDemoRoutesSnapshot(
        window.localStorage.getItem(INTEGRATION_DEMO_ROUTES_STORAGE_KEY),
      );
      frame = window.requestAnimationFrame(() => setDemoRoutes(storedRoutes));
    } catch {
      // The integration demo remains usable when storage is unavailable.
    }
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selectChannel = (channelId: DeliveryChannelId) => {
    setActiveChannelId(channelId);
    setAnnouncement(null);
  };

  const toggleDemoRoute = (provider: IntegrationProviderDefinition) => {
    const isSelected = demoRoutes[activeChannelId] === provider.id;
    setDemoRoutes((current) => {
      const next = {
        ...current,
        [activeChannelId]: isSelected ? null : provider.id,
      };
      try {
        window.localStorage.setItem(
          INTEGRATION_DEMO_ROUTES_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // The selected demo route still works for the current page session.
      }
      return next;
    });
    setAnnouncement(
      isSelected
        ? `${provider.name} удалён из демомаршрута «${activeChannel.shortLabel}». Реальное подключение не изменилось.`
        : `${provider.name} выбран для демомаршрута «${activeChannel.shortLabel}». Сообщения не отправляются.`,
    );
  };

  const saveDraft = () => {
    if (!selectedProvider || !selectedSetup) return;

    setDraftProviderKeys((current) => {
      const next = new Set(current);
      next.add(
        getChannelProviderKey(
          selectedSetup.channelId,
          selectedSetup.providerId,
        ),
      );
      return next;
    });
    const selectedChannel = deliveryChannelById[selectedSetup.channelId];
    setAnnouncement(
      `Черновик настройки ${selectedProvider.name} для канала «${selectedChannel.shortLabel}» сохранён только в текущем сеансе. Реальное подключение не выполнено.`,
    );
    setSelectedSetup(null);
  };

  const exportVkWorkspaceRecipients = () => {
    const recipients = contacts
      .filter((contact) => contact.status === "active")
      .map((contact) => contact.email)
      .join("\n");
    const blob = new Blob([recipients], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mailflow-vk-workspace-recipients.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setAnnouncement(
      `Подготовлен TXT-список из ${contacts.filter((contact) => contact.status === "active").length} демо-контактов. Загрузите его в нативный модуль «Рассылки» VK WorkSpace; отправка не запускалась.`,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Инфраструктура рассылок"
        title="Каналы и интеграции"
        description="Соберите единый маршрут для email, Telegram и ВКонтакте. Сначала подготовьте провайдера, затем выберите его в кампании."
        action={
          <Badge variant="accent" dot className="min-h-7 px-3">
            Безопасный деморежим
          </Badge>
        }
      />

      <Alert
        tone="info"
        title="Сейчас внешние сервисы не подключены"
        icon={<ShieldCheck aria-hidden="true" className="size-4" />}
      >
        Можно изучить требования, сохранить черновик настройки и собрать
        демомаршрут. Токены и пароли здесь не запрашиваются, API-вызовы не
        выполняются, сообщения контактам не уходят.
      </Alert>

      {announcement ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-[11px] border border-primary/15 bg-primary-subtle px-4 py-3 text-[12px] leading-5 text-text"
        >
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <span>{announcement}</span>
        </div>
      ) : null}

      <section
        aria-label="Состояние интеграций"
        className="grid gap-3 sm:grid-cols-3"
      >
        <StatusCard
          icon={<Braces aria-hidden="true" className="size-4" />}
          label="Доступно провайдеров"
          value="5"
          description="Для трёх каналов"
        />
        <StatusCard
          icon={<CircleDashed aria-hidden="true" className="size-4" />}
          label="Реальных подключений"
          value="0"
          description="Нужна серверная настройка"
        />
        <StatusCard
          icon={<Route aria-hidden="true" className="size-4" />}
          label="Демомаршрутов"
          value={String(configuredDemoRoutes)}
          description="Без внешней отправки"
        />
      </section>

      <section className="card overflow-hidden" aria-labelledby="channels-title">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2
                id="channels-title"
                className="text-[15px] font-semibold tracking-[-0.015em]"
              >
                Выберите канал доставки
              </h2>
              <p className="mt-1 text-[12px] text-text-muted">
                Для каждого канала используется отдельный провайдер и отдельное
                согласие получателя.
              </p>
            </div>
            <span className="text-[11px] font-medium text-text-subtle">
              Шаг 1 из 2
            </span>
          </div>
        </div>

        <div
          className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5"
          role="group"
          aria-label="Каналы доставки"
        >
          {deliveryChannels.map((channel) => {
            const Icon = channelIcons[channel.id];
            const selected = channel.id === activeChannelId;
            const demoProvider = demoRoutes[channel.id]
              ? integrationProviderById[demoRoutes[channel.id]!]
              : null;

            return (
              <button
                key={channel.id}
                type="button"
                aria-pressed={selected}
                aria-describedby={`channel-${channel.id}-description`}
                onClick={() => selectChannel(channel.id)}
                className={`min-h-[150px] rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 active:scale-[.99] ${
                  selected
                    ? "border-primary/40 bg-primary-subtle shadow-[0_0_0_1px_rgb(99_91_255_/_0.08)]"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-subtle/50"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span
                    className={`grid size-9 place-items-center rounded-[10px] ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-subtle text-text-muted"
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  {demoProvider ? (
                    <Badge variant="accent" className="max-w-[130px] truncate">
                      {demoProvider.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Не выбран</Badge>
                  )}
                </span>
                <span className="mt-4 block text-[13px] font-semibold text-text-strong">
                  {channel.label}
                </span>
                <span
                  id={`channel-${channel.id}-description`}
                  className="mt-1 block text-[11px] leading-4.5 text-text-muted"
                >
                  {channel.providerIds.length} {providerWord(channel.providerIds.length)}
                  <span aria-hidden="true"> · </span>
                  <span className="block pt-1 text-text-subtle">
                    Поле контакта: {channel.contactField}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
        <section aria-labelledby="providers-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="section-eyebrow">Шаг 2</p>
              <h2
                id="providers-title"
                className="mt-2 text-[18px] font-semibold tracking-[-0.025em]"
              >
                Провайдеры: {activeChannel.shortLabel}
              </h2>
              <p className="mt-1 max-w-2xl text-[12px] leading-5 text-text-muted">
                {activeChannel.description}
              </p>
            </div>
            <Badge variant="neutral" className="shrink-0">
              {providers.length} {providerWord(providers.length)}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {providers.map((provider) => {
              const draftSaved = draftProviderKeys.has(
                getChannelProviderKey(activeChannelId, provider.id),
              );
              const inDemoRoute = demoRoutes[activeChannelId] === provider.id;

              return (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  activeChannelId={activeChannelId}
                  draftSaved={draftSaved}
                  inDemoRoute={inDemoRoute}
                  onPrepare={() =>
                    setSelectedSetup({
                      channelId: activeChannelId,
                      providerId: provider.id,
                    })
                  }
                  onToggleRoute={() => toggleDemoRoute(provider)}
                />
              );
            })}
          </div>

          {activeChannelId === "email" ? (
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-[#bcd8ff] bg-[#f3f8ff] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#1777ff] text-white">
                  <Download aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <h3 className="text-[12px] font-semibold text-text-strong">
                    Нативные «Рассылки» VK WorkSpace
                  </h3>
                  <p className="mt-1 max-w-2xl text-[10px] leading-4 text-text-muted">
                    Публичного API у этого режима нет: MAILFLOW подготовит TXT-список,
                    а HTML, отправитель и запуск настраиваются в интерфейсе VK WorkSpace.
                    Для полной автоматизации используется отдельный SMTP-маршрут.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={exportVkWorkspaceRecipients}
                leadingIcon={<Download aria-hidden="true" className="size-3.5" />}
              >
                Скачать демо TXT
              </Button>
            </div>
          ) : null}
        </section>

        <aside className="card xl:sticky xl:top-[92px]" aria-labelledby="route-title">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-[9px] bg-primary-subtle text-primary">
                <Route aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 id="route-title" className="text-[14px] font-semibold">
                  Демомаршрут кампании
                </h2>
                <p className="mt-0.5 text-[10px] text-text-subtle">
                  Только схема, без отправки
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {deliveryChannels.map((channel) => {
              const providerId = demoRoutes[channel.id];
              const provider = providerId
                ? integrationProviderById[providerId]
                : null;
              const Icon = channelIcons[channel.id];

              return (
                <div
                  key={channel.id}
                  className="flex items-center gap-3 rounded-[10px] border border-border bg-surface-subtle/55 p-3"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-text-muted shadow-[var(--shadow-xs)]">
                    <Icon aria-hidden="true" className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-text-strong">
                      {channel.shortLabel}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-text-muted">
                      {provider?.name ?? "Провайдер не выбран"}
                    </p>
                  </div>
                  {provider ? (
                    <Check aria-label="Выбран" className="size-4 text-success" />
                  ) : (
                    <CircleDashed
                      aria-label="Не выбран"
                      className="size-4 text-text-subtle"
                    />
                  )}
                </div>
              );
            })}

            <div className="rounded-[10px] border border-dashed border-border-strong p-3.5">
              <p className="text-[11px] font-semibold text-text-strong">
                Что проверится перед запуском
              </p>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-text-muted">
                <li className="flex gap-2">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-success"
                  />
                  Согласие и доступность контакта в канале
                </li>
                <li className="flex gap-2">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-success"
                  />
                  Подтверждённый отправитель или бот
                </li>
                <li className="flex gap-2">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-success"
                  />
                  Лимиты и тестовая доставка
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="flow-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <p className="section-eyebrow">Архитектура</p>
            <h2
              id="flow-title"
              className="mt-2 text-[17px] font-semibold tracking-[-0.02em]"
            >
              Ключи остаются на сервере, кампания — в одном интерфейсе
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-text-muted">
              После реального подключения MAILFLOW будет выбирать адаптер по
              каналу, отправлять сообщение провайдеру и возвращать единый статус
              доставки. Браузер не должен получать секретные ключи.
            </p>
          </div>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] lg:max-w-[620px] lg:self-center">
            <FlowStep icon={Sparkles} label="Кампания" description="Текст и аудитория" />
            <ArrowRight
              aria-hidden="true"
              className="hidden size-4 self-center text-text-subtle sm:block"
            />
            <FlowStep icon={ServerCog} label="Адаптер" description="Выбор провайдера" />
            <ArrowRight
              aria-hidden="true"
              className="hidden size-4 self-center text-text-subtle sm:block"
            />
            <FlowStep icon={Bot} label="Канал" description="Доставка и статус" />
          </div>
        </div>
      </section>

      <ProviderSetupModal
        provider={selectedProvider}
        activeChannelId={selectedChannelId}
        open={Boolean(selectedProvider)}
        onOpenChange={(open) => {
          if (!open) setSelectedSetup(null);
        }}
        onSaveDraft={saveDraft}
      />
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="card flex min-w-0 items-center gap-3.5 p-4 sm:p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-subtle text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[11px] font-medium text-text-muted">
            {label}
          </p>
          <p className="text-[20px] font-semibold tracking-[-0.035em] text-text-strong">
            {value}
          </p>
        </div>
        <p className="mt-0.5 text-[10px] text-text-subtle">{description}</p>
      </div>
    </article>
  );
}

function ProviderCard({
  provider,
  activeChannelId,
  draftSaved,
  inDemoRoute,
  onPrepare,
  onToggleRoute,
}: {
  provider: IntegrationProviderDefinition;
  activeChannelId: DeliveryChannelId;
  draftSaved: boolean;
  inDemoRoute: boolean;
  onPrepare: () => void;
  onToggleRoute: () => void;
}) {
  const channel = deliveryChannelById[activeChannelId];

  return (
    <article className="card flex min-h-[330px] flex-col overflow-hidden">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-[12px] font-bold text-white shadow-[var(--shadow-xs)]"
            style={{ backgroundColor: provider.accent }}
          >
            {provider.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold tracking-[-0.015em]">
                {provider.name}
              </h3>
              {inDemoRoute ? (
                <Badge variant="accent" dot>
                  В демомаршруте
                </Badge>
              ) : draftSaved ? (
                <Badge variant="warning" dot>
                  Черновик
                </Badge>
              ) : (
                <Badge variant="outline" dot>
                  Не подключено
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[10px] font-medium text-text-subtle">
              {provider.category}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[12px] leading-5 text-text-muted">
          {provider.summary}
        </p>

        <div className="mt-4 rounded-[10px] bg-surface-subtle p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
            Лучше всего подходит
          </p>
          <p className="mt-1.5 text-[11px] leading-4.5 text-text">
            {provider.recommendedFor}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {provider.channelIds.map((channelId) => (
            <Badge key={channelId} variant="neutral">
              {deliveryChannelById[channelId].shortLabel}
            </Badge>
          ))}
          <Badge variant="outline">Нужна серверная настройка</Badge>
        </div>

        <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-text-muted">
          <LockKeyhole
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-text-subtle"
          />
          {provider.limitations[0]}
        </p>
      </div>

      <div className="grid gap-2 border-t border-border bg-surface-subtle/35 p-4 sm:grid-cols-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrepare}
          leadingIcon={<KeyRound aria-hidden="true" className="size-3.5" />}
        >
          {draftSaved ? "Продолжить настройку" : "Подготовить"}
        </Button>
        <Button
          variant={inDemoRoute ? "outline" : "primary"}
          size="sm"
          onClick={onToggleRoute}
          aria-pressed={inDemoRoute}
          leadingIcon={
            inDemoRoute ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Route aria-hidden="true" className="size-3.5" />
            )
          }
        >
          {inDemoRoute ? "Маршрут выбран" : `Выбрать для ${channel.shortLabel}`}
        </Button>
      </div>
    </article>
  );
}

function ProviderSetupModal({
  provider,
  activeChannelId,
  open,
  onOpenChange,
  onSaveDraft,
}: {
  provider: IntegrationProviderDefinition | null;
  activeChannelId: DeliveryChannelId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDraft: () => void;
}) {
  if (!provider) return null;

  const channel = deliveryChannelById[activeChannelId];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Подготовка: ${provider.name}`}
      description={`${channel.label} · черновик без передачи ключей и API-вызовов`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={onSaveDraft}
            leadingIcon={<Check aria-hidden="true" className="size-4" />}
          >
            Сохранить черновик
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert
          tone="warning"
          title="Не вставляйте токены и пароли в демоверсию"
          icon={<LockKeyhole aria-hidden="true" className="size-4" />}
        >
          Эта форма показывает состав будущей настройки. Для реального запуска
          секреты нужно добавить в защищённую серверную конфигурацию.
        </Alert>

        <section aria-labelledby="credentials-title">
          <div className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-4 text-primary" />
            <h3 id="credentials-title" className="text-[13px] font-semibold">
              Что потребуется
            </h3>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {provider.credentials.map((credential) => (
              <li
                key={credential}
                className="flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-subtle/45 p-3 text-[11px] leading-4.5 text-text"
              >
                <CircleDashed
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                />
                {credential}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-title">
          <div className="flex items-center gap-2">
            <ServerCog aria-hidden="true" className="size-4 text-primary" />
            <h3 id="steps-title" className="text-[13px] font-semibold">
              План подключения
            </h3>
          </div>
          <ol className="mt-3 space-y-2">
            {provider.setupSteps.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-[10px] border border-border p-3"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-subtle text-[10px] font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-[11px] leading-4.5 text-text-muted">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="route-preview-title"
          className="rounded-xl border border-primary/15 bg-primary-subtle/70 p-4"
        >
          <div className="flex items-center gap-2">
            <Route aria-hidden="true" className="size-4 text-primary" />
            <h3 id="route-preview-title" className="text-[12px] font-semibold">
              Будущий маршрут
            </h3>
          </div>
          <p className="mt-2 font-mono text-[10px] leading-4.5 text-text-muted">
            {provider.route}
          </p>
        </section>

        <section aria-labelledby="limitations-title">
          <h3 id="limitations-title" className="text-[13px] font-semibold">
            Ограничения и правила
          </h3>
          <ul className="mt-2 space-y-1.5">
            {provider.limitations.map((limitation) => (
              <li
                key={limitation}
                className="flex items-start gap-2 text-[11px] leading-4.5 text-text-muted"
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-success"
                />
                {limitation}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}

function FlowStep({
  icon: Icon,
  label,
  description,
}: {
  icon: typeof Mail;
  label: string;
  description: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-[10px] border border-border bg-surface-subtle/55 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-primary shadow-[var(--shadow-xs)]">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-text-strong">{label}</p>
        <p className="truncate text-[9px] text-text-subtle">{description}</p>
      </div>
    </div>
  );
}

function providerWord(count: number) {
  if (count === 1) return "провайдер";
  if (count > 1 && count < 5) return "провайдера";
  return "провайдеров";
}

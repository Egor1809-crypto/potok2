"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Mail,
  MessageCircleMore,
  MessagesSquare,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Unplug,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  buttonVariants,
} from "@/components/ui";
import {
  deliveryChannels,
  getProvidersForChannel,
  integrationProviderById,
  PREFERRED_PROVIDERS_STORAGE_KEY,
  type DeliveryChannelId,
  type IntegrationProviderDefinition,
  type IntegrationProviderId,
} from "@/config/integrations";
import type {
  ApiError,
  IntegrationConnectionStatus,
  IntegrationMutationResponse,
  IntegrationRecord,
  WorkspaceSnapshot,
} from "@/types/api";

type ConnectionStatus = IntegrationConnectionStatus;

type ApiMode = "loading" | "online" | "offline";

type SetupField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "email" | "url" | "text";
  hint: string;
};

const channelIcons = {
  email: Mail,
  telegram: MessageCircleMore,
  vk: MessagesSquare,
} satisfies Record<DeliveryChannelId, typeof Mail>;

const setupFields: Record<IntegrationProviderId, SetupField[]> = {
  "vk-workspace": [
    {
      key: "senderEmail",
      label: "Корпоративный адрес отправителя",
      placeholder: "mailing@company.ru",
      type: "email",
      hint: "Полный адрес ящика VK WorkSpace. Пароль приложения хранится только в защищённой конфигурации сервера.",
    },
  ],
  "telegram-bot-api": [
    {
      key: "botUsername",
      label: "Имя бота",
      placeholder: "company_bot",
      hint: "Без символа @. Токен бота хранится только на сервере.",
    },
  ],
  "vk-api": [
    {
      key: "communityId",
      label: "Идентификатор сообщества",
      placeholder: "123456789",
      hint: "Ключ доступа сообщества задаётся на сервере.",
    },
  ],
  unisender: [
    {
      key: "senderEmail",
      label: "Проверенный адрес отправителя",
      placeholder: "mailing@company.ru",
      type: "email",
      hint: "Секретный ключ подключения задаётся только на сервере.",
    },
    {
      key: "listId",
      label: "Номер списка получателей",
      placeholder: "123456",
      hint: "Сервер проверит, что список получателей существует.",
    },
  ],
};

const statusMeta: Record<
  ConnectionStatus,
  { label: string; badge: "success" | "warning" | "neutral"; icon: typeof CheckCircle2 }
> = {
  connected: { label: "Подключено", badge: "success", icon: CheckCircle2 },
  needs_attention: { label: "Нужна настройка", badge: "warning", icon: CircleAlert },
  disconnected: { label: "Не подключено", badge: "neutral", icon: CircleDashed },
};

function isProviderId(value: unknown): value is IntegrationProviderId {
  return typeof value === "string" && value in integrationProviderById;
}

function normalizeIntegrations(value: unknown): IntegrationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is IntegrationRecord => {
    if (!item || typeof item !== "object") return false;
    const record = item as Partial<IntegrationRecord>;
    if (!isProviderId(record.providerId)) return false;
    const status = record.status;
    if (
      status !== "connected" &&
      status !== "needs_attention" &&
      status !== "disconnected"
    ) {
      return false;
    }
    return true;
  });
}

function readPreferredProviders() {
  const fallback = Object.fromEntries(
    deliveryChannels.map((channel) => [channel.id, channel.providerIds[0]]),
  ) as Record<DeliveryChannelId, IntegrationProviderId>;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(PREFERRED_PROVIDERS_STORAGE_KEY) ?? "{}",
    ) as Partial<Record<DeliveryChannelId, IntegrationProviderId>>;
    deliveryChannels.forEach((channel) => {
      if (value[channel.id] && channel.providerIds.includes(value[channel.id]!)) {
        fallback[channel.id] = value[channel.id]!;
      }
    });
  } catch {
    // The provider can still be selected for the current page session.
  }
  const route = readRequestedSetup();
  if (route) fallback[route.channelId] = route.providerId;
  return fallback;
}

function readRequestedSetup(): {
  channelId: DeliveryChannelId;
  providerId: IntegrationProviderId;
} | null {
  const params = new URLSearchParams(window.location.search);
  const channelId = params.get("channel");
  const providerId = params.get("provider");
  if (
    (channelId !== "email" && channelId !== "telegram" && channelId !== "vk") ||
    !isProviderId(providerId) ||
    !getProvidersForChannel(channelId).some((provider) => provider.id === providerId)
  ) {
    return null;
  }
  return { channelId, providerId };
}

export function IntegrationsView() {
  const [apiMode, setApiMode] = React.useState<ApiMode>("loading");
  const [records, setRecords] = React.useState<IntegrationRecord[]>([]);
  const [preferredProviders, setPreferredProviders] = React.useState<
    Record<DeliveryChannelId, IntegrationProviderId>
  >(() => Object.fromEntries(
    deliveryChannels.map((channel) => [channel.id, channel.providerIds[0]]),
  ) as Record<DeliveryChannelId, IntegrationProviderId>);
  const [setupProviderId, setSetupProviderId] =
    React.useState<IntegrationProviderId | null>(null);
  const [setupChannelId, setSetupChannelId] =
    React.useState<DeliveryChannelId>("email");
  const [setupValues, setSetupValues] = React.useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{
    tone: "success" | "warning" | "danger";
    title: string;
    text: string;
  } | null>(null);

  const loadIntegrations = React.useCallback(async () => {
    setApiMode("loading");
    setNotice(null);
    try {
      const response = await fetch("/api/workspace", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Сервис настроек временно недоступен.");
      const body = await response.json() as WorkspaceSnapshot;
      const nextRecords = normalizeIntegrations(body.integrations);
      setRecords(nextRecords);
      const requestedSetup = readRequestedSetup();
      if (requestedSetup) {
        setSetupValues(
          nextRecords.find((record) => record.providerId === requestedSetup.providerId)?.publicConfig ?? {},
        );
      }
      setApiMode("online");
    } catch {
      setRecords([]);
      setApiMode("offline");
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPreferredProviders(readPreferredProviders());
      const requestedSetup = readRequestedSetup();
      if (requestedSetup) {
        setSetupChannelId(requestedSetup.channelId);
        setSetupProviderId(requestedSetup.providerId);
        setSetupValues({});
      }
      void loadIntegrations();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadIntegrations]);

  const recordByProvider = React.useMemo(
    () => Object.fromEntries(records.map((record) => [record.providerId, record])) as
      Partial<Record<IntegrationProviderId, IntegrationRecord>>,
    [records],
  );

  const readyChannels = deliveryChannels.filter((channel) =>
    channel.providerIds.some(
      (providerId) =>
        recordByProvider[providerId]?.status === "connected" &&
        integrationProviderById[providerId].deliveryMode !== "roadmap",
    ),
  ).length;

  const chooseProvider = (channelId: DeliveryChannelId, providerId: IntegrationProviderId) => {
    const next = { ...preferredProviders, [channelId]: providerId };
    setPreferredProviders(next);
    try {
      window.localStorage.setItem(
        PREFERRED_PROVIDERS_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // Preference remains available in memory.
    }
  };

  const openSetup = (channelId: DeliveryChannelId, providerId: IntegrationProviderId) => {
    setSetupChannelId(channelId);
    setSetupProviderId(providerId);
    setSetupValues(recordByProvider[providerId]?.publicConfig ?? {});
    setNotice(null);
  };

  const saveIntegration = async () => {
    if (!setupProviderId) return;
    setBusyAction(`save:${setupProviderId}`);
    setNotice(null);
    try {
      const response = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          providerId: setupProviderId,
          action: "save",
          enabled: true,
          publicConfig: setupValues,
        }),
      });
      const savedBody = await response.json() as IntegrationMutationResponse | ApiError;
      if (!response.ok || !("integration" in savedBody)) {
        throw new Error("error" in savedBody ? savedBody.error : "Не удалось сохранить настройку.");
      }
      const checkResponse = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ providerId: setupProviderId, action: "check" }),
      });
      const checkBody = await checkResponse.json() as IntegrationMutationResponse | ApiError;
      if (!checkResponse.ok || !("integration" in checkBody)) {
        throw new Error("error" in checkBody ? checkBody.error : "Проверка провайдера не выполнена.");
      }
      const [integration] = normalizeIntegrations([checkBody.integration]);
      if (!integration) throw new Error("Сервер вернул некорректный статус интеграции.");
      setRecords((current) => [
        integration,
        ...current.filter((item) => item.providerId !== integration.providerId),
      ]);
      setApiMode("online");
      setSetupProviderId(null);
      setNotice({
        tone: integration.status === "connected" ? "success" : "warning",
        title: integration.status === "connected" ? "Интеграция готова" : "Публичные настройки сохранены",
        text: integration.statusMessage,
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Настройка не сохранена",
        text: error instanceof Error ? error.message : "Проверьте соединение и повторите попытку.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const checkIntegration = async (providerId: IntegrationProviderId) => {
    setBusyAction(`check:${providerId}`);
    setNotice(null);
    try {
      const response = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ providerId, action: "check" }),
      });
      const body = await response.json() as IntegrationMutationResponse | ApiError;
      if (!response.ok || !("integration" in body)) {
        throw new Error("error" in body ? body.error : "Проверка провайдера не выполнена.");
      }
      const [integration] = normalizeIntegrations([body.integration]);
      if (!integration) throw new Error("Сервер вернул некорректный статус интеграции.");
      setRecords((current) => [
        integration,
        ...current.filter((item) => item.providerId !== providerId),
      ]);
      setNotice({
        tone: integration.status === "connected" ? "success" : "warning",
        title: integration.status === "connected" ? "Проверка пройдена" : "Проверка не пройдена",
        text: integration.statusMessage,
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Проверка не выполнена",
        text: error instanceof Error ? error.message : "Повторите попытку.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const disconnect = async (providerId: IntegrationProviderId) => {
    setBusyAction(`disconnect:${providerId}`);
    setNotice(null);
    try {
      const response = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ providerId, action: "disconnect" }),
      });
      const body = await response.json() as IntegrationMutationResponse | ApiError;
      if (!response.ok || !("integration" in body)) {
        throw new Error("error" in body ? body.error : "Не удалось отключить интеграцию.");
      }
      const [integration] = normalizeIntegrations([body.integration]);
      if (integration) {
        setRecords((current) => [
          integration,
          ...current.filter((item) => item.providerId !== providerId),
        ]);
      }
      setNotice({
        tone: "success",
        title: "Интеграция отключена",
        text: `${integrationProviderById[providerId].name} больше не используется новыми кампаниями.`,
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Не удалось отключить",
        text: error instanceof Error ? error.message : "Повторите попытку.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const selectedSetupProvider = setupProviderId
    ? integrationProviderById[setupProviderId]
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <PageHeader
        eyebrow="Настройка доставки"
        title="Каналы и интеграции"
        description="Подключите хотя бы один провайдер. Затем выберите его на третьем шаге создания кампании."
        action={
          <Link href="/campaigns/new" className={buttonVariants({ variant: "primary" })}>
            Создать кампанию
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />

      {apiMode === "offline" ? (
        <Alert tone="danger" title="Интеграции не загружены">
          Сервер рабочего пространства не отвечает. Пустые статусы ниже не являются
          данными провайдеров; настройки не будут сохранены.
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void loadIntegrations()}
            leadingIcon={<RefreshCw aria-hidden="true" className="size-3.5" />}
          >
            Повторить подключение
          </Button>
        </Alert>
      ) : (
        <Alert tone="info" title="Статус подтверждается провайдером" icon={<ShieldCheck aria-hidden="true" className="size-4" />}>
          Сохранение формы не означает подключение. Кнопка проверки выполняет безопасный
          запрос конкретного провайдера; секреты читаются только из серверного окружения.
        </Alert>
      )}

      {notice ? (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.text}
        </Alert>
      ) : null}

      <section className="card overflow-hidden" aria-labelledby="delivery-checklist-title">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 id="delivery-checklist-title" className="text-[17px] font-semibold text-text-strong">
              Чек-лист подключения
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-text-muted">
              Канал → провайдер → статус → следующий шаг.
            </p>
          </div>
          <Badge variant={readyChannels > 0 ? "success" : "warning"} dot className="w-fit">
            Готово каналов: {readyChannels} из {deliveryChannels.length}
          </Badge>
        </div>

        <div className="divide-y divide-border">
          {deliveryChannels.map((channel, index) => {
            const Icon = channelIcons[channel.id];
            const providerId = preferredProviders[channel.id];
            const provider = integrationProviderById[providerId];
            const record = recordByProvider[providerId];
            const status = apiMode === "online" ? record?.status ?? "disconnected" : "disconnected";
            const meta = statusMeta[status];
            const campaignHref = `/campaigns/new?channel=${channel.id}&provider_${channel.id}=${provider.id}`;

            return (
              <article key={channel.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[48px_minmax(190px,.8fr)_minmax(220px,1fr)_170px_170px] lg:items-center">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                    {index + 1}. Канал
                  </p>
                  <h3 className="mt-1 text-[15px] font-semibold text-text-strong">{channel.shortLabel}</h3>
                  <p className="mt-1 text-[12px] leading-5 text-text-muted">{channel.contactField}</p>
                </div>

                <FormField label="Провайдер" htmlFor={`provider-${channel.id}`}>
                  <Select
                    id={`provider-${channel.id}`}
                    value={providerId}
                    onChange={(event) => chooseProvider(channel.id, event.target.value as IntegrationProviderId)}
                    options={getProvidersForChannel(channel.id).map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                </FormField>

                <div className="lg:justify-self-start">
                  <Badge variant={meta.badge} dot>
                    {apiMode === "loading" ? "Проверяем…" : meta.label}
                  </Badge>
                  <p className="mt-2 text-[11px] leading-4 text-text-muted">
                    {record?.statusMessage ?? (status === "connected"
                      ? "Проверка провайдера пройдена"
                      : status === "needs_attention"
                        ? "Нужна повторная проверка"
                        : "Сначала сохраните настройку")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {status === "connected" && provider.deliveryMode !== "roadmap" ? (
                    <Link href={campaignHref} className={buttonVariants({ variant: "primary", size: "sm" })}>
                      В кампанию
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openSetup(channel.id, provider.id)}
                      leadingIcon={<Settings2 aria-hidden="true" className="size-3.5" />}
                    >
                      Настроить
                    </Button>
                  )}
                  {record?.enabled ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busyAction === `check:${provider.id}`}
                      loadingText="Проверяем…"
                      onClick={() => void checkIntegration(provider.id)}
                      leadingIcon={<RefreshCw aria-hidden="true" className="size-3.5" />}
                    >
                      Проверить
                    </Button>
                  ) : null}
                  {record?.enabled ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Отключить ${provider.name}`}
                      loading={busyAction === `disconnect:${provider.id}`}
                      onClick={() => void disconnect(provider.id)}
                      leadingIcon={<Unplug aria-hidden="true" className="size-3.5" />}
                    >
                      Отключить
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="rounded-xl border border-[#bcd8ff] bg-[#f3f8ff] p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1777ff] text-white">
              <Mail aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-text-strong">VK WorkSpace SMTP внутри Потока</h2>
              <p className="mt-1 text-[12px] leading-5 text-text-muted">
                После подключения пароля приложения Поток сам отправит HTML-письмо с рабочими
                кнопками выбранным получателям. Открывать VK WorkSpace и загружать CSV не потребуется.
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/campaigns/new?channel=email&provider_email=vk-workspace"
          className={buttonVariants({ variant: "secondary" })}
        >
          Создать кампанию
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>

      <SetupModal
        provider={selectedSetupProvider}
        channelId={setupChannelId}
        values={setupValues}
        onValueChange={(key, value) => setSetupValues((current) => ({ ...current, [key]: value }))}
        open={Boolean(selectedSetupProvider)}
        onOpenChange={(open) => !open && setSetupProviderId(null)}
        onSave={() => void saveIntegration()}
        saving={Boolean(setupProviderId && busyAction === `save:${setupProviderId}`)}
      />
    </div>
  );
}

function SetupModal({
  provider,
  channelId,
  values,
  onValueChange,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  provider: IntegrationProviderDefinition | null;
  channelId: DeliveryChannelId;
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!provider) return null;
  const fields = setupFields[provider.id];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Настройка ${provider.name}`}
      description={`Канал: ${deliveryChannels.find((channel) => channel.id === channelId)?.shortLabel}. Сервер сохранит открытые параметры, затем выполнит отдельную проверку провайдера.`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            onClick={onSave}
            loading={saving}
            loadingText="Проверяем…"
            leadingIcon={<ShieldCheck aria-hidden="true" className="size-4" />}
          >
            Сохранить и проверить
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert tone="info" title="Секреты не вводятся в браузере">
          Токены, пароли и API-ключи берутся из серверного окружения. Эта форма
          сохраняет только открытые идентификаторы и адреса.
        </Alert>

        {fields.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            htmlFor={`integration-${provider.id}-${field.key}`}
            hint={field.hint}
          >
            <Input
              id={`integration-${provider.id}-${field.key}`}
              type={field.type ?? "text"}
              value={values[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) => onValueChange(field.key, event.target.value)}
            />
          </FormField>
        ))}

        <div className="rounded-xl border border-border bg-surface-subtle p-4">
          <p className="text-[12px] font-semibold text-text-strong">Что проверит сервер</p>
          <ul className="mt-2 space-y-2 text-[12px] leading-5 text-text-muted">
            {provider.credentials.slice(0, 3).map((credential) => (
              <li key={credential} className="flex gap-2">
                <CircleDashed aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
                {credential}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

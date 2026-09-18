export const VK_WORKSPACE_QUEUE_DEFAULTS = {
  totalDailyLimit: 300,
  accountDailyLimit: 150,
  accountHourlyLimit: 20,
  workdayStartHour: 9,
  workdayEndHour: 18,
  timeZone: "Europe/Moscow",
  batchSize: 5,
  seriousErrorThreshold: 5,
} as const;

export const VK_WORKSPACE_RETRY_DELAYS_MS = [
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export type VkWorkspaceAccount = {
  id: "primary" | "secondary";
  email: string;
  password: string;
  dailyLimit: number;
  hourlyLimit: number;
};

export type VkWorkspaceQueueConfig = {
  accounts: VkWorkspaceAccount[];
  totalDailyLimit: number;
  workdayStartHour: number;
  workdayEndHour: number;
  timeZone: string;
  batchSize: number;
  seriousErrorThreshold: number;
};

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function hour(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback;
}

export function resolveVkWorkspaceQueueConfig(
  publicConfig: Record<string, string>,
  secret: (key: string) => string,
): VkWorkspaceQueueConfig {
  const dailyLimit = positiveInteger(
    publicConfig.accountDailyLimit,
    VK_WORKSPACE_QUEUE_DEFAULTS.accountDailyLimit,
    10_000,
  );
  const hourlyLimit = positiveInteger(
    publicConfig.accountHourlyLimit,
    VK_WORKSPACE_QUEUE_DEFAULTS.accountHourlyLimit,
    10_000,
  );
  const candidates = [
    {
      id: "primary" as const,
      email: publicConfig.senderEmail?.trim() || secret("VK_WORKSPACE_SMTP_EMAIL"),
      password: secret("VK_WORKSPACE_SMTP_PASSWORD"),
    },
    {
      id: "secondary" as const,
      email: publicConfig.senderEmail2?.trim() || secret("VK_WORKSPACE_SMTP_EMAIL_2"),
      password: secret("VK_WORKSPACE_SMTP_PASSWORD_2"),
    },
  ];
  return {
    accounts: candidates
      .filter((account) => Boolean(account.email && account.password))
      .map((account) => ({ ...account, dailyLimit, hourlyLimit })),
    totalDailyLimit: positiveInteger(
      publicConfig.totalDailyLimit,
      VK_WORKSPACE_QUEUE_DEFAULTS.totalDailyLimit,
      20_000,
    ),
    workdayStartHour: hour(publicConfig.workdayStartHour, VK_WORKSPACE_QUEUE_DEFAULTS.workdayStartHour),
    workdayEndHour: hour(publicConfig.workdayEndHour, VK_WORKSPACE_QUEUE_DEFAULTS.workdayEndHour),
    timeZone: publicConfig.timeZone?.trim() || VK_WORKSPACE_QUEUE_DEFAULTS.timeZone,
    batchSize: positiveInteger(publicConfig.batchSize, VK_WORKSPACE_QUEUE_DEFAULTS.batchSize, 25),
    seriousErrorThreshold: positiveInteger(
      publicConfig.seriousErrorThreshold,
      VK_WORKSPACE_QUEUE_DEFAULTS.seriousErrorThreshold,
      25,
    ),
  };
}

export function zonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const dateKey = `${read("year")}-${read("month")}-${read("day")}`;
  const localHour = Number.parseInt(read("hour"), 10);
  return { dateKey, hourKey: `${dateKey}T${String(localHour).padStart(2, "0")}`, localHour };
}

export function withinVkWorkspaceWindow(date: Date, config: VkWorkspaceQueueConfig) {
  const { localHour } = zonedDateParts(date, config.timeZone);
  return localHour >= config.workdayStartHour && localHour < config.workdayEndHour;
}

export function nextVkWorkspaceWindow(date: Date, config: VkWorkspaceQueueConfig) {
  if (withinVkWorkspaceWindow(date, config)) return date;
  const candidate = new Date(date);
  candidate.setUTCSeconds(0, 0);
  for (let minute = 0; minute < 48 * 60; minute += 1) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
    if (withinVkWorkspaceWindow(candidate, config)) return candidate;
  }
  return new Date(date.getTime() + 24 * 60 * 60_000);
}

export function retryAtAfterFailure(attempts: number, now = new Date()) {
  const delay = VK_WORKSPACE_RETRY_DELAYS_MS[attempts - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay);
}

export function classifyVkWorkspaceSmtpError(message: string) {
  const normalized = message.toLocaleLowerCase("en");
  const seriousAccount = /(?:auth|login|password|credential|account|blocked|suspend|quota|limit|too many|535|534|530)/i.test(normalized);
  const transient = /(?:timeout|timed out|вовремя|закрыл соединение|network|socket|temporary|try again|421|450|451|452|454)/i.test(normalized);
  const permanentRecipient = !seriousAccount && /(?:mailbox unavailable|unknown user|recipient|address rejected|550|551|552|553|554)/i.test(normalized);
  return { seriousAccount, transient: transient || (!permanentRecipient && !seriousAccount), permanentRecipient };
}

export function estimateVkWorkspaceDays(recipientCount: number, config: VkWorkspaceQueueConfig) {
  const dailyCapacity = Math.min(
    config.totalDailyLimit,
    config.accounts.reduce((total, account) => total + account.dailyLimit, 0),
  );
  return {
    configuredAccounts: config.accounts.length,
    dailyCapacity,
    estimatedDays: dailyCapacity > 0 ? Math.max(1, Math.ceil(recipientCount / dailyCapacity)) : null,
  };
}

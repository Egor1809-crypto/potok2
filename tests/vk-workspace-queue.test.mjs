import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyVkWorkspaceSmtpError,
  estimateVkWorkspaceDays,
  resolveVkWorkspaceQueueConfig,
  retryAtAfterFailure,
  withinVkWorkspaceWindow,
} from "../lib/server/vk-workspace-queue.ts";

const secrets = {
  VK_WORKSPACE_SMTP_PASSWORD: "primary-secret",
  VK_WORKSPACE_SMTP_PASSWORD_2: "secondary-secret",
};

test("VK Workspace queue discovers two independent mailboxes and default quotas", () => {
  const config = resolveVkWorkspaceQueueConfig({
    senderEmail: "one@example.ru",
    senderEmail2: "two@example.ru",
  }, (key) => secrets[key] ?? "");
  assert.equal(config.accounts.length, 2);
  assert.equal(config.accounts[0].dailyLimit, 150);
  assert.equal(config.accounts[1].hourlyLimit, 20);
  assert.deepEqual(estimateVkWorkspaceDays(1500, config), {
    configuredAccounts: 2,
    dailyCapacity: 300,
    estimatedDays: 5,
  });
});

test("VK Workspace queue accepts only the second configured mailbox", () => {
  const config = resolveVkWorkspaceQueueConfig({
    senderEmail: "info@example.ru",
    senderEmail2: "tickets@example.ru",
  }, (key) => key === "VK_WORKSPACE_SMTP_PASSWORD_2" ? "tickets-secret" : "");
  assert.deepEqual(config.accounts.map(({ id, email }) => ({ id, email })), [
    { id: "secondary", email: "tickets@example.ru" },
  ]);
  assert.deepEqual(estimateVkWorkspaceDays(1500, config), {
    configuredAccounts: 1,
    dailyCapacity: 150,
    estimatedDays: 10,
  });
});

test("VK Workspace queue keeps marketing sends inside the configured local window", () => {
  const config = resolveVkWorkspaceQueueConfig({ senderEmail: "one@example.ru", timeZone: "Europe/Moscow" }, (key) => secrets[key] ?? "");
  assert.equal(withinVkWorkspaceWindow(new Date("2026-09-18T06:00:00.000Z"), config), true);
  assert.equal(withinVkWorkspaceWindow(new Date("2026-09-18T15:00:00.000Z"), config), false);
});

test("VK Workspace retries follow 15 minute, one hour and six hour delays", () => {
  const now = new Date("2026-09-18T10:00:00.000Z");
  assert.equal(retryAtAfterFailure(1, now)?.toISOString(), "2026-09-18T10:15:00.000Z");
  assert.equal(retryAtAfterFailure(2, now)?.toISOString(), "2026-09-18T11:00:00.000Z");
  assert.equal(retryAtAfterFailure(3, now)?.toISOString(), "2026-09-18T16:00:00.000Z");
  assert.equal(retryAtAfterFailure(4, now), null);
});

test("SMTP authentication failures pause an account while invalid recipients stay permanent", () => {
  assert.equal(classifyVkWorkspaceSmtpError("535 Authentication failed").seriousAccount, true);
  assert.equal(classifyVkWorkspaceSmtpError("550 unknown recipient").permanentRecipient, true);
  assert.equal(classifyVkWorkspaceSmtpError("421 temporary service unavailable").transient, true);
});

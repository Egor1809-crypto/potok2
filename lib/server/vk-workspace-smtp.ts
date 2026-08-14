export type SmtpCheckResult = {
  ok: boolean;
  identity?: string;
  message: string;
};

export type SmtpRecipientMessage = {
  outboxId: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SmtpRecipientResult = {
  outboxId: string;
  status: "accepted" | "rejected" | "ambiguous";
  message: string;
  externalId?: string;
};

type SmtpConnectionOptions = {
  host: string;
  port: number;
  username: string;
  password: string;
  timeoutMs?: number;
};

type CloudflareSocket = {
  opened: Promise<unknown>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
};

type CloudflareConnect = (
  address: { hostname: string; port: number },
  options: { secureTransport: "on"; allowHalfOpen: boolean },
) => CloudflareSocket;

function base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function header(value: string) {
  return `=?UTF-8?B?${base64(value.replace(/[\r\n]+/g, " "))}?=`;
}

function dotStuff(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n")
    .map((line) => line.startsWith(".") ? `.${line}` : line)
    .join("\r\n");
}

function messageId(domain: string) {
  const random = crypto.randomUUID().replaceAll("-", "");
  return `<${Date.now()}.${random}@${domain}>`;
}

function buildMimeMessage(
  senderName: string,
  senderEmail: string,
  message: SmtpRecipientMessage,
) {
  const boundary = `potok-${crypto.randomUUID()}`;
  const domain = senderEmail.split("@")[1] || "potok.local";
  const id = messageId(domain);
  const lines = [
    `From: ${header(senderName)} <${senderEmail}>`,
    `To: <${message.to}>`,
    `Subject: ${header(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${id}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(message.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(message.html),
    `--${boundary}--`,
    "",
  ];
  return { data: dotStuff(lines.join("\r\n")), id };
}

async function openSession(options: SmtpConnectionOptions) {
  // Keep the Worker-only module out of Node's server-render graph. Vite still
  // resolves it at runtime inside Cloudflare when an SMTP operation begins.
  const socketModuleName = ["cloudflare", "sockets"].join(":");
  const { connect } = await import(/* @vite-ignore */ socketModuleName) as { connect: CloudflareConnect };
  const socket = connect(
    { hostname: options.host, port: options.port },
    { secureTransport: "on", allowHalfOpen: false },
  );
  const timeoutMs = options.timeoutMs ?? 15_000;
  await Promise.race([
    socket.opened,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("SMTP-сервер не ответил вовремя.")), timeoutMs)),
  ]);
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const readReply = async () => {
    const lines: string[] = [];
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        lines.push(line);
        if (/^\d{3} /.test(line)) {
          return { code: Number(line.slice(0, 3)), message: lines.join(" ") };
        }
        continue;
      }
      const chunk = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("SMTP-сервер не ответил вовремя.")), timeoutMs)),
      ]);
      if (chunk.done) throw new Error("SMTP-сервер закрыл соединение.");
      buffer += decoder.decode(chunk.value, { stream: true });
    }
  };

  const command = async (value: string, acceptedCodes: number[]) => {
    await writer.write(encoder.encode(`${value}\r\n`));
    const reply = await readReply();
    if (!acceptedCodes.includes(reply.code)) throw new Error(reply.message || `SMTP: ${reply.code}`);
    return reply;
  };

  const greeting = await readReply();
  if (greeting.code !== 220) throw new Error(greeting.message || "SMTP-сервер отклонил подключение.");
  await command("EHLO potok.email", [250]);
  await command("AUTH LOGIN", [334]);
  await command(base64(options.username), [334]);
  await command(base64(options.password), [235]);

  return {
    command,
    async data(value: string) {
      await writer.write(encoder.encode(`${value}\r\n.\r\n`));
      const reply = await readReply();
      if (reply.code !== 250) throw new Error(reply.message || "SMTP-сервер не принял письмо.");
      return reply;
    },
    async close() {
      try { await command("QUIT", [221]); } catch { /* socket may already be closed */ }
      try { writer.releaseLock(); } catch { /* noop */ }
      try { reader.releaseLock(); } catch { /* noop */ }
      try { await socket.close(); } catch { /* noop */ }
    },
  };
}

export async function checkVkWorkspaceSmtp(options: SmtpConnectionOptions): Promise<SmtpCheckResult> {
  let session: Awaited<ReturnType<typeof openSession>> | null = null;
  try {
    session = await openSession(options);
    await session.command("NOOP", [250]);
    return {
      ok: true,
      identity: options.username,
      message: `SMTP-подключение подтверждено для ${options.username}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `SMTP: ${error.message}` : "SMTP-проверка завершилась ошибкой.",
    };
  } finally {
    await session?.close();
  }
}

export async function sendVkWorkspaceSmtpBatch(
  options: SmtpConnectionOptions & { senderName: string; senderEmail: string },
  messages: SmtpRecipientMessage[],
): Promise<SmtpRecipientResult[]> {
  const session = await openSession(options);
  const results: SmtpRecipientResult[] = [];
  try {
    for (const message of messages) {
      try {
        await session.command(`MAIL FROM:<${options.senderEmail}>`, [250]);
        await session.command(`RCPT TO:<${message.to}>`, [250, 251]);
        await session.command("DATA", [354]);
        const mime = buildMimeMessage(options.senderName, options.senderEmail, message);
        const reply = await session.data(mime.data);
        results.push({
          outboxId: message.outboxId,
          status: "accepted",
          externalId: mime.id,
          message: reply.message || "VK WorkSpace SMTP принял письмо.",
        });
      } catch (error) {
        try { await session.command("RSET", [250]); } catch { /* keep the original error */ }
        results.push({
          outboxId: message.outboxId,
          status: "rejected",
          message: error instanceof Error ? error.message : "SMTP-сервер отклонил письмо.",
        });
      }
    }
    return results;
  } finally {
    await session.close();
  }
}

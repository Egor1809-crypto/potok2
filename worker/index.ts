/** Поток: Cloudflare Worker, planned campaigns and scoped storage maintenance. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function runDueCampaignsInBackground(ctx: ExecutionContext) {
  ctx.waitUntil(
    import("../lib/server/mailflow-store")
      .then(async ({ runDueScheduledCampaignsSystem, runVkWorkspaceMarketingQueuesSystem }) => {
        await runDueScheduledCampaignsSystem();
        await runVkWorkspaceMarketingQueuesSystem();
      })
      .catch((error) => {
        console.error("Automatic campaign scheduler failed.", error);
      }),
  );
}

let nextMaintenanceCheck = 0;
function maintainProjectInBackground(ctx: ExecutionContext) {
  if (Date.now() < nextMaintenanceCheck) return;
  nextMaintenanceCheck = Date.now() + 5 * 60_000;
  ctx.waitUntil(import("../lib/server/project-maintenance")
    .then(({ maintainProjectStorage }) => maintainProjectStorage())
    .catch(error => { nextMaintenanceCheck = 0; console.error("Project maintenance failed.", error); }));
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Public auth and webhooks establish their own identity. Business APIs run
    // inside the workspace obtained from the signed-in participant, never a URL.
    let response: Response;
    const publicApi = /^\/api\/(?:auth\/|assets\/[^/]+$|telegram\/webhook\/|communications\/inbound$)/.test(url.pathname);
    if (url.pathname.startsWith("/api/") && !publicApi) {
      try {
        const { ensureSystemDatabase, requireWorkspaceParticipant } = await import("../lib/server/database-init");
        const { withWorkspace } = await import("../lib/server/workspace-context");
        await ensureSystemDatabase();
        const session = await requireWorkspaceParticipant(request);
        response = await withWorkspace(session.participant.workspaceId,
          () => handler.fetch(request, env, ctx), session, request);
      } catch (error) {
        const { jsonError } = await import("../lib/server/api-utils");
        response = jsonError(error);
      }
    } else {
      response = await handler.fetch(request, env, ctx);
    }

    // Sites deployments can briefly miss a newly-published cron trigger. The
    // calendar polls this authenticated endpoint every 30 seconds, so use that
    // normal traffic as an idempotent safety net for already-approved plans.
    if (request.method === "GET" && url.pathname === "/api/workspace" && response.ok) {
      runDueCampaignsInBackground(ctx);
      maintainProjectInBackground(ctx);
    }

    return response;
  },
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    runDueCampaignsInBackground(ctx);
    maintainProjectInBackground(ctx);
  },
};

export default worker;

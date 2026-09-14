import { getD1 } from "@/db";
import { ensureSystemDatabase, WORKSPACE_ID } from "./database-init";
import { pruneProjectEphemera } from "@/lib/maintenance/ephemera";

export async function maintainProjectStorage() {
  await ensureSystemDatabase();
  const report = await pruneProjectEphemera(getD1(), WORKSPACE_ID);
  if (report) console.info("Project maintenance completed", report);
  return report;
}

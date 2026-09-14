import { getD1 } from "@/db";
import { newId } from "./api-utils";

/** All tenant-owned rows are committed together; no data is copied from a team. */
export async function privateWorkspaceStatements(input: { participantId: string; displayName: string; email: string; login?: string; passwordHash?: string; passwordSalt?: string }) {
  const db = getD1(), id = newId("workspace"), now = new Date().toISOString();
  const name = `${input.displayName} · Поток`;
  const statements = [
    db.prepare("INSERT INTO workspaces (id,name,company_name,default_sender_name,created_at,updated_at) VALUES (?,?,?, ?,?,?)").bind(id,name,"",input.displayName,now,now),
    db.prepare("INSERT INTO participants (id,workspace_id,login,password_hash,password_salt,display_name,email,color,status,role,access_scope,last_login_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'#7839ed','active','admin',?, ?,?,?)")
      .bind(input.participantId,id,input.login ?? null,input.passwordHash ?? null,input.passwordSalt ?? null,input.displayName,input.email,JSON.stringify({all:true,baseIds:[],groupTags:[]}),now,now,now),
  ];
  for (const provider of ["vk-workspace","telegram-bot-api","vk-api","unisender"]) statements.push(
    db.prepare("INSERT INTO integrations (id,workspace_id,provider_id,enabled,public_config,check_status,check_message,created_at,updated_at) VALUES (?,?,?,0,'{}','disconnected',?, ?,?)")
      .bind(newId("integration"),id,provider,"Подключите свой канал отправки.",now,now));
  const { starterEmailTemplateValues } = await import("./starter-template-library");
  for (const template of starterEmailTemplateValues(["template-client-welcome", "template-monthly-insight", "template-product-brief"])) {
    const templateId = `${id}:starter:${template.id}`;
    const document = {...template.builderDocument, templateId};
    statements.push(db.prepare("INSERT INTO email_templates (id,workspace_id,name,name_key,description,category,subject,preview_text,email_body_html,email_body_text,builder_document,is_favorite,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)")
      .bind(templateId,id,template.name,template.nameKey,template.description,template.category,template.subject,template.previewText,template.emailBodyHtml,template.emailBodyText,JSON.stringify(document),now,now));
  }
  return { id, statements };
}

import type { AiEmailBrief } from "@/types/email-ai";
export function emptyAiEmailBrief(): AiEmailBrief {
  return { description: "", goal: "custom", audience: "", primaryAction: "", cta: { text: "", url: "" }, tone: "expert", length: "medium", designStyle: "auto", brand: { name: "", website: "", primaryColor: "", accentColor: "", textColor: "", backgroundColor: "", companyName: "", address: "", privacyUrl: "" }, requiredContent: "", requiredFacts: [], forbiddenClaims: [], deadline: "", visuals: "auto", assets: [] };
}

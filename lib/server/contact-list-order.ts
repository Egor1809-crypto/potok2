import { asc, desc } from "drizzle-orm";
import { contacts } from "@/db/schema";

/** Sort the complete filtered result before pagination, with a stable tie-breaker. */
export function contactListOrder(sort: string | null) {
  switch (sort) {
    case "name-asc": return [asc(contacts.fullName), asc(contacts.id)];
    case "name-desc": return [desc(contacts.fullName), desc(contacts.id)];
    case "updated-asc": return [asc(contacts.updatedAt), asc(contacts.id)];
    default: return [desc(contacts.updatedAt), desc(contacts.id)];
  }
}

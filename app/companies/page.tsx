import { redirect } from "next/navigation";

/** Компания теперь атрибут контакта, а не отдельная fake-CRM без API. */
export default function CompaniesPage() {
  redirect("/contacts");
}

import { redirect } from "next/navigation";

/** Импорт теперь является режимом общей базы контактов. */
export default function ImportPage() {
  redirect("/contacts?view=import");
}

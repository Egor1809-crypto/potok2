import { getD1 } from "@/db";
import { registrationConsent, registrationConsentStatement } from "@/config/legal";
import { ApiRequestError, asObject, newId } from "./api-utils";

export function requireRegistrationConsent(payload: unknown) {
  const value = asObject(payload);
  if (value.dataConsent !== true || value.consentVersion !== registrationConsent.version) {
    throw new ApiRequestError("Для создания аккаунта прочитайте и подтвердите отдельное согласие на обработку персональных данных.", 400);
  }
}
/** Caller includes this in the same transaction as account creation. */
export function registrationConsentInsert(participantId: string, method: "password" | "yandex", acceptedAt = new Date().toISOString()) {
  return getD1().prepare("INSERT INTO registration_consents (id,participant_id,version,statement,method,accepted_at) VALUES (?,?,?,?,?,?)")
    .bind(newId("registration-consent"), participantId, registrationConsent.version, registrationConsentStatement(), method, acceptedAt);
}

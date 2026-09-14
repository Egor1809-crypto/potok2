/** Discard only transient project drafts when changing the signed-in account. */
export function clearAccountDrafts() {
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (/^(?:potok:(?:email-draft|presentation-draft):|mailflow:campaign-wizard-handoff:)/.test(key)) window.sessionStorage.removeItem(key);
    }
  } catch { /* Storage can be disabled; authentication must remain available. */ }
}

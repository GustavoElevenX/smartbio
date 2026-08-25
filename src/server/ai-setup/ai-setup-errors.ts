import "server-only";

export class AISetupNotFoundError extends Error {
  readonly code = "onboarding_session_not_found";
}

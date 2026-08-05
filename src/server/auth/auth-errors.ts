import "server-only";

export class AuthenticationRequiredError extends Error {
  readonly code = "authentication_required";
  readonly status = 401;
  constructor(message = "Faça login para continuar.") { super(message); this.name = "AuthenticationRequiredError"; }
}

export class EmailNotConfirmedError extends Error {
  readonly code = "email_not_confirmed";
  readonly status = 403;
  constructor(message = "Confirme seu e-mail para continuar.") { super(message); this.name = "EmailNotConfirmedError"; }
}

export class WorkspaceRequiredError extends Error {
  readonly code = "workspace_required";
  readonly status = 404;
  constructor(message = "Nenhum workspace está disponível para esta conta.") { super(message); this.name = "WorkspaceRequiredError"; }
}

export class WorkspaceAccessDeniedError extends Error {
  readonly code = "workspace_access_denied";
  readonly status = 403;
  constructor(message = "Você não tem acesso a este workspace.") { super(message); this.name = "WorkspaceAccessDeniedError"; }
}

export class ProjectNotFoundError extends Error {
  readonly code = "project_not_found";
  readonly status = 404;
  constructor(message = "Projeto não encontrado.") { super(message); this.name = "ProjectNotFoundError"; }
}

export class ProductionConfigurationError extends Error {
  readonly code = "production_configuration_error";
  readonly status = 503;
  constructor(message = "A aplicação não está configurada para operar com segurança.") { super(message); this.name = "ProductionConfigurationError"; }
}

export type AuthError = AuthenticationRequiredError | EmailNotConfirmedError | WorkspaceRequiredError | WorkspaceAccessDeniedError | ProjectNotFoundError | ProductionConfigurationError;

export function authErrorStatus(error: unknown) {
  return error instanceof AuthenticationRequiredError ||
    error instanceof EmailNotConfirmedError ||
    error instanceof WorkspaceRequiredError ||
    error instanceof WorkspaceAccessDeniedError ||
    error instanceof ProjectNotFoundError ||
    error instanceof ProductionConfigurationError
    ? error.status
    : 500;
}

export function authErrorCode(error: unknown) {
  return error instanceof AuthenticationRequiredError ||
    error instanceof EmailNotConfirmedError ||
    error instanceof WorkspaceRequiredError ||
    error instanceof WorkspaceAccessDeniedError ||
    error instanceof ProjectNotFoundError ||
    error instanceof ProductionConfigurationError
    ? error.code
    : "internal_error";
}

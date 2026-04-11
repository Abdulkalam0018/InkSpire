export class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createAppError(code, message, status = 400, details) {
  return new AppError(code, message, status, details);
}

export function isAppError(error) {
  return error instanceof AppError || Boolean(error?.code && error?.message);
}

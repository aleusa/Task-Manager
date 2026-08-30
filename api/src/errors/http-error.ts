export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class ResourceNotFoundError extends HttpError {
  constructor(message = "Resource not found") {
    super(404, "RESOURCE_NOT_FOUND", message);
    this.name = "ResourceNotFoundError";
  }
}

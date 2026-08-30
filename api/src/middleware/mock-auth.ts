import type { RequestHandler } from "express";

import { env } from "../config/env.js";

export const mockAuthentication: RequestHandler = (request, _response, next) => {
  request.auth = {
    currentUserId: env.MOCK_CURRENT_USER_ID,
    currentOrganizationId: env.MOCK_CURRENT_ORGANIZATION_ID,
  };

  next();
};

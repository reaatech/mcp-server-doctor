import { logger } from '../observability/logger.js';

export interface CredentialResult {
  apiKey?: string;
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}

export function resolveCredentials(opts: {
  apiKey?: string;
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}): CredentialResult {
  const apiKey = opts.apiKey || process.env.MCP_API_KEY;
  const bearerToken = opts.bearerToken || process.env.MCP_BEARER_TOKEN;
  const oauthClientId = opts.oauthClientId || process.env.MCP_OAUTH_CLIENT_ID;
  const oauthClientSecret = opts.oauthClientSecret || process.env.MCP_OAUTH_CLIENT_SECRET;

  if (opts.apiKey) {
    logger.warn(
      'Credentials passed via --api-key are visible in process listings. Consider using the MCP_API_KEY environment variable instead.',
    );
  }
  if (opts.bearerToken) {
    logger.warn(
      'Credentials passed via --bearer-token are visible in process listings. Consider using the MCP_BEARER_TOKEN environment variable instead.',
    );
  }
  if (opts.oauthClientSecret) {
    logger.warn(
      'Credentials passed via --oauth-client-secret are visible in process listings. Consider using the MCP_OAUTH_CLIENT_SECRET environment variable instead.',
    );
  }

  return { apiKey, bearerToken, oauthClientId, oauthClientSecret };
}

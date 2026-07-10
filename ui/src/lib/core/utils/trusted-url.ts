const S3_HOST_PATTERN =
  /^(?:[a-z0-9][a-z0-9.-]*\.)?s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i;

const PROTECTED_PATH_PATTERN = /\/protected\/[^/]+\//i;

function hasAwsSignedUrlParams(params: URLSearchParams): boolean {
  return params.has('X-Amz-Signature') && params.has('X-Amz-Credential');
}

/**
 * Allow only HTTPS S3 presigned URLs for protected document objects.
 * Rejects javascript:, data:, blob:, and non-AWS hosts.
 */
export function isTrustedDocumentPreviewUrl(rawUrl: string): boolean {
  if (!rawUrl?.trim()) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  if (!S3_HOST_PATTERN.test(parsed.hostname)) {
    return false;
  }

  if (!PROTECTED_PATH_PATTERN.test(parsed.pathname)) {
    return false;
  }

  if (!hasAwsSignedUrlParams(parsed.searchParams)) {
    return false;
  }

  return true;
}

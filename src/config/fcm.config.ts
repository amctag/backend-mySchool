import { registerAs } from '@nestjs/config';

function trim(value: string | undefined): string {
  let trimmed = (value ?? '').trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export default registerAs('fcm', () => ({
  projectId: trim(process.env.FCM_PROJECT_ID),
  credentialsJson: trim(process.env.FCM_CREDENTIALS_JSON),
  credentialsBase64: trim(process.env.FCM_CREDENTIALS_BASE64),
}));

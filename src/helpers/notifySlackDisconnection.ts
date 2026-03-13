import config from "@/config";
import { asyncSleep } from "@/helpers/asyncSleep";
import logger from "@/lib/logger";

const SLACK_NOTIFY_MAX_RETRIES = 3;
const SLACK_NOTIFY_RETRY_DELAY_MS = 2000;

export async function notifySlackDisconnection(
  phoneNumber: string,
  reason: string,
): Promise<void> {
  const slackWebhookUrl = config.slack.webhookUrl;
  if (!slackWebhookUrl) {
    logger.warn(
      "[%s] [notifySlackDisconnection] SLACK_WEBHOOK_URL env not set - no Slack notification sent (reason: %s). Set SLACK_WEBHOOK_URL to receive alerts.",
      phoneNumber,
      reason,
    );
    return;
  }

  const body = JSON.stringify({
    text: `🔴 WhatsApp desconectado: ${phoneNumber} (motivo: ${reason})`,
  });

  for (let attempt = 1; attempt <= SLACK_NOTIFY_MAX_RETRIES; attempt++) {
    try {
      logger.info(
        "[%s] [notifySlackDisconnection] Sending to Slack (reason: %s, attempt: %d/%d)",
        phoneNumber,
        reason,
        attempt,
        SLACK_NOTIFY_MAX_RETRIES,
      );
      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const responseBody = await response.text();
      if (!response.ok) {
        logger.error(
          "[%s] [notifySlackDisconnection] Slack returned %s: %s (attempt %d/%d)",
          phoneNumber,
          response.status,
          responseBody,
          attempt,
          SLACK_NOTIFY_MAX_RETRIES,
        );
        if (attempt < SLACK_NOTIFY_MAX_RETRIES) {
          await asyncSleep(SLACK_NOTIFY_RETRY_DELAY_MS);
        }
        continue;
      }
      logger.info(
        "[%s] [notifySlackDisconnection] Slack OK (reason: %s)",
        phoneNumber,
        reason,
      );
      return;
    } catch (error) {
      logger.error(
        "[%s] [notifySlackDisconnection] Failed attempt %d/%d: %s",
        phoneNumber,
        attempt,
        SLACK_NOTIFY_MAX_RETRIES,
        error instanceof Error ? error.message : String(error),
      );
      if (attempt < SLACK_NOTIFY_MAX_RETRIES) {
        await asyncSleep(SLACK_NOTIFY_RETRY_DELAY_MS);
      }
    }
  }

  logger.error(
    "[%s] [notifySlackDisconnection] All %d attempts failed",
    phoneNumber,
    SLACK_NOTIFY_MAX_RETRIES,
  );
}

import config from "@/config";
import logger from "@/lib/logger";

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
  try {
    logger.info(
      "[%s] [notifySlackDisconnection] Sending to Slack (reason: %s)",
      phoneNumber,
      reason,
    );
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔴 WhatsApp desconectado: ${phoneNumber} (motivo: ${reason})`,
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      logger.error(
        "[%s] [notifySlackDisconnection] Slack returned %s: %s",
        phoneNumber,
        response.status,
        body,
      );
      return;
    }
    logger.info(
      "[%s] [notifySlackDisconnection] Slack OK (reason: %s)",
      phoneNumber,
      reason,
    );
  } catch (error) {
    logger.error(
      "[%s] [notifySlackDisconnection] Failed: %s",
      phoneNumber,
      error instanceof Error ? error.message : String(error),
    );
  }
}

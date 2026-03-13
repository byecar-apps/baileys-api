import config from "@/config";
import logger from "@/lib/logger";

export async function notifySlackDisconnection(
  phoneNumber: string,
  reason: string,
): Promise<void> {
  const slackWebhookUrl = config.slack.webhookUrl;
  if (!slackWebhookUrl) {
    logger.debug(
      "[%s] [notifySlackDisconnection] SLACK_WEBHOOK_URL not set, skipping",
      phoneNumber,
    );
    return;
  }
  try {
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔴 WhatsApp desconectado: ${phoneNumber} (motivo: ${reason})`,
      }),
    });
    logger.info(
      "[%s] [notifySlackDisconnection] Slack notified (reason: %s) status: %s",
      phoneNumber,
      reason,
      response.status,
    );
  } catch (error) {
    logger.error(
      "[%s] [notifySlackDisconnection] Failed to notify Slack: %s",
      phoneNumber,
      error instanceof Error ? error.message : String(error),
    );
  }
}

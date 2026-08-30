import app from "./app";
import { logger } from "./lib/logger";
import { scheduleOpenEvSync } from "./scripts/import-openev";
import { startWalletMaintenance } from "./scripts/walletMaintenance";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Без секрета админ-токены подделываются кем угодно — падаем сразу, а не
// уходим в работу с заведомо небезопасной конфигурацией.
if (!process.env["ADMIN_JWT_SECRET"]) {
  throw new Error(
    "ADMIN_JWT_SECRET environment variable is required but was not provided. " +
      "Сгенерировать: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
  );
}

// Ключ шифрования учётных данных операторов не обязателен для старта, но без
// него нельзя сохранить api_credentials — предупреждаем один раз.
if (!process.env["CREDENTIALS_ENCRYPTION_KEY"]) {
  logger.warn(
    "CREDENTIALS_ENCRYPTION_KEY is not set — operator API credentials cannot be saved",
  );
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start OpenEV dataset sync (runs immediately if table empty, then weekly)
  scheduleOpenEvSync().catch(e => logger.warn({ err: e }, "OpenEV sync init failed"));

  // Обслуживание кошелька: снятие протухших холдов, автоотмена платежей, сверка.
  startWalletMaintenance();
});

-- Идемпотентность платежей на уровне БД (security-review, деньги/токены).
--
-- Код кошелька уже сериализует зачисления через FOR UPDATE по строке кошелька,
-- но эти уникальные индексы делают двойное зачисление и дубль-транзакцию
-- физически невозможными — независимо от будущих изменений логики.
--
-- Индексы частичные: старые строки без ключа (payment_txn_id / provider_txn_id
-- IS NULL) не участвуют, поэтому существующие корректные данные не ломаются.
-- Если создание падает на дубликате — значит в данных уже есть двойное
-- зачисление, и его надо разобрать вручную (это и есть цель проверки).

-- Одна платёжная транзакция → максимум одна строка журнала каждого типа.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_txn_payment_type
  ON wallet_transactions (payment_txn_id, type)
  WHERE payment_txn_id IS NOT NULL;

-- Один _id провайдера → одна транзакция (защита CreateTransaction от гонки).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_txn_provider_id
  ON payment_transactions (provider, provider_txn_id)
  WHERE provider_txn_id IS NOT NULL;

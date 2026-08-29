import { pgTable, serial, text, integer, timestamp, pgEnum, index } from "drizzle-orm/pg-core";

/**
 * Жалобы пользователей на неточности в данных станции.
 *
 * Зачем отдельная таблица, а не обращения в поддержку: жалоба привязана к
 * конкретной станции и к конкретному полю. Из неё видно, что именно неверно,
 * и её можно превратить в правку одним действием — тогда как обращение в
 * поддержку приходится читать и разбирать руками.
 *
 * Это самый дешёвый способ поддерживать базу в актуальном состоянии: объехать
 * все станции страны нереально, а пользователь стоит перед станцией прямо
 * сейчас и видит, что не так.
 */

export const stationReportReasonEnum = pgEnum("station_report_reason", [
  "not_working",     // станция не работает
  "wrong_price",     // цена не совпадает
  "wrong_location",  // неверные координаты или адрес
  "wrong_connectors", // не те разъёмы или их количество
  "permanently_closed", // станции больше нет
  "other",
]);

export const stationReportStatusEnum = pgEnum("station_report_status", [
  "new",
  "confirmed", // проверено, данные исправлены
  "rejected",  // проверено, данные верны
]);

export const stationReportsTable = pgTable(
  "station_reports",
  {
    id: serial("id").primaryKey(),
    station_id: integer("station_id").notNull(),
    user_id: text("user_id").notNull(),
    reason: stationReportReasonEnum("reason").notNull(),
    /** Свободный комментарий: что именно не так. */
    comment: text("comment"),
    status: stationReportStatusEnum("status").notNull().default("new"),
    /** Кто разобрал жалобу — почта администратора. */
    resolved_by: text("resolved_by"),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Очередь необработанных жалоб в админке и история по станции.
    index("idx_station_reports_status").on(t.status, t.created_at),
    index("idx_station_reports_station").on(t.station_id),
  ],
);

export type StationReport = typeof stationReportsTable.$inferSelect;

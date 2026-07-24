import { Router, type IRouter } from "express";
import { eq, and, lte, gte, or, isNull, sql } from "drizzle-orm";
import { db, bannersTable } from "@workspace/db";
import { z } from "zod";
import { adminAuth } from "./admin";

const router: IRouter = Router();

// ── Validation schemas ────────────────────────────────────────────────────────
// Accepts full ISO-8601 OR browser datetime-local "YYYY-MM-DDTHH:mm".
// refine prevents RangeError from bubbling as 500; invalid input returns 400.
const flexDatetime = z
  .string()
  .refine(
    (v) => /Z|[+-]\d{2}:\d{2}$/.test(v) || !isNaN(new Date(v).getTime()),
    { message: "Invalid datetime value" },
  )
  .transform((v) => (/Z|[+-]\d{2}:\d{2}$/.test(v) ? v : new Date(v).toISOString()))
  .pipe(z.string().datetime());

const BannerBody = z.object({
  title:             z.string().min(1),
  subtitle:          z.string().optional().nullable(),
  image_url:         z.string().url().optional().nullable(),
  background_type:   z.enum(["gradient", "image"]).default("gradient"),
  gradient_from:     z.string().optional().nullable(),
  gradient_to:       z.string().optional().nullable(),
  cta_text:          z.string().optional().nullable(),
  cta_target:        z.string().optional().nullable(),
  show_countdown:    z.boolean().default(false),
  countdown_ends_at: flexDatetime.optional().nullable(),
  priority:          z.number().int().default(0),
  is_active:         z.boolean().default(true),
  starts_at:         flexDatetime.optional().nullable(),
  ends_at:           flexDatetime.optional().nullable(),
});

const BannerIdParam = z.object({ id: z.coerce.number().int().positive() });

const ReorderItem = z.object({ id: z.number().int().positive(), priority: z.number().int() });

// ── GET /api/banners ─────────────────────────────────────────────────────────
// ?active=true filters to currently active banners
router.get("/banners", async (req, res): Promise<void> => {
  const activeOnly = req.query.active === "true";
  const now = new Date();

  let rows = await db.select().from(bannersTable).orderBy(bannersTable.priority);

  if (activeOnly) {
    rows = rows.filter(b => {
      if (!b.is_active) return false;
      if (b.starts_at && new Date(b.starts_at) > now) return false;
      if (b.ends_at   && new Date(b.ends_at)   < now) return false;
      return true;
    });
  }

  res.json(rows);
});

// ── POST /api/banners ─────────────────────────────────────────────────────────
router.post("/banners", adminAuth, async (req, res): Promise<void> => {
  const parsed = BannerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [banner] = await db.insert(bannersTable).values(parsed.data as any).returning();
  res.status(201).json(banner);
});

// ── PATCH /api/banners/reorder — bulk priority update ────────────────────────
// Must come BEFORE /:id to avoid "reorder" being parsed as an id
router.patch("/banners/reorder", adminAuth, async (req, res): Promise<void> => {
  const parsed = z.array(ReorderItem).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Update each banner's priority individually (no CASE...WHEN in Drizzle ORM without raw SQL)
  await Promise.all(
    parsed.data.map(({ id, priority }) =>
      db.update(bannersTable).set({ priority }).where(eq(bannersTable.id, id))
    )
  );

  const rows = await db.select().from(bannersTable).orderBy(bannersTable.priority);
  res.json(rows);
});

// ── PATCH /api/banners/:id ────────────────────────────────────────────────────
router.patch("/banners/:id", adminAuth, async (req, res): Promise<void> => {
  const p = BannerIdParam.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const parsed = BannerBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [banner] = await db.update(bannersTable).set(parsed.data as any).where(eq(bannersTable.id, p.data.id)).returning();
  if (!banner) { res.status(404).json({ error: "Banner not found" }); return; }
  res.json(banner);
});

// ── DELETE /api/banners/:id ───────────────────────────────────────────────────
router.delete("/banners/:id", adminAuth, async (req, res): Promise<void> => {
  const p = BannerIdParam.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(bannersTable).where(eq(bannersTable.id, p.data.id));
  res.sendStatus(204);
});

export default router;

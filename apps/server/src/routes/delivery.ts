import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

export const deliveryRouter = Router();

deliveryRouter.get("/delivery-partners", async (_req, res) => {
  const partners = await prisma.deliveryPartner.findMany({ orderBy: { name: "asc" } });
  res.json(partners);
});

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * No paid Places API key is wired up yet, so this returns a Google Maps search
 * link (no key required) centered on the user's coordinates when provided,
 * plus the grocery delivery apps as a fallback. Swap in a real Places API
 * integration later for in-app nearby results with ratings/distance.
 */
deliveryRouter.get("/nearby-stores", async (req, res) => {
  const parsed = nearbyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { lat, lng } = parsed.data;

  const mapsSearchUrl =
    lat !== undefined && lng !== undefined
      ? `https://www.google.com/maps/search/supermarket/@${lat},${lng},15z`
      : "https://www.google.com/maps/search/?api=1&query=supermarket+near+me";

  const partners = await prisma.deliveryPartner.findMany({ orderBy: { name: "asc" } });

  res.json({ mapsSearchUrl, deliveryPartners: partners });
});

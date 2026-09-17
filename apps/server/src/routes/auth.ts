import { Router } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db";
import { hashPassword, signToken, verifyPassword } from "../utils/auth";
import { requireAuth } from "../middleware/auth";
import { env } from "../env";

export const authRouter = Router();

const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(80),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      preference: { create: {} },
    },
    include: { preference: true },
  });

  const token = signToken({ userId: user.id });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, preference: user.preference },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { preference: true } });
  if (user && !user.passwordHash) {
    res.status(401).json({ error: "This account signs in with Google — use the Google sign-in button instead" });
    return;
  }
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, preference: user.preference },
  });
});

const googleSchema = z.object({
  idToken: z.string().min(1),
});

authRouter.post("/google", async (req, res) => {
  if (!googleClient || !env.googleClientId) {
    res.status(501).json({ error: "Google sign-in is not configured on this server yet" });
    return;
  }
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.idToken,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    res.status(401).json({ error: "Invalid Google sign-in token" });
    return;
  }
  if (!payload?.email || !payload.sub) {
    res.status(401).json({ error: "Invalid Google sign-in token" });
    return;
  }

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
    include: { preference: true },
  });

  if (user && !user.googleId) {
    // Existing email/password account signing in with Google for the first time — link it.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub },
      include: { preference: true },
    });
  } else if (!user) {
    user = await prisma.user.create({
      data: {
        email: payload.email,
        googleId: payload.sub,
        name: payload.name ?? payload.email.split("@")[0],
        preference: { create: {} },
      },
      include: { preference: true },
    });
  }

  const token = signToken({ userId: user.id });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, preference: user.preference },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { preference: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, preference: user.preference });
});

const preferencesSchema = z.object({
  dietGoal: z.enum(["NONE", "FIT", "INDULGENT", "BALANCED"]).optional(),
  favoriteCuisineSlugs: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
});

authRouter.put("/me/preferences", requireAuth, async (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const preference = await prisma.preference.upsert({
    where: { userId: req.userId! },
    update: parsed.data,
    create: { userId: req.userId!, ...parsed.data },
  });
  res.json(preference);
});

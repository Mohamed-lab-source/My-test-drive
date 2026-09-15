import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, signToken, verifyPassword } from "../utils/auth";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

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

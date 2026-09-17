import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./env";
import { authRouter } from "./routes/auth";
import { recipesRouter } from "./routes/recipes";
import { shoppingListsRouter } from "./routes/shoppingLists";
import { deliveryRouter } from "./routes/delivery";
import { favoritesRouter } from "./routes/favorites";
import { ratingsRouter } from "./routes/ratings";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/google", authLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Some PaaS platforms (Railway included) default their deploy healthcheck
// to "/" rather than a configured path -- keep this cheap and dependency-free
// so it can't itself become a source of failed healthchecks.
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "cookmate-api" });
});

app.use("/api/auth", authRouter);
app.use("/api", recipesRouter);
app.use("/api", shoppingListsRouter);
app.use("/api", deliveryRouter);
app.use("/api", favoritesRouter);
app.use("/api", ratingsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`Cookmate API listening on http://localhost:${env.port}`);
});

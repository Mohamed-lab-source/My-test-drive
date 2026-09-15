import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./env";
import { authRouter } from "./routes/auth";
import { recipesRouter } from "./routes/recipes";
import { shoppingListsRouter } from "./routes/shoppingLists";
import { deliveryRouter } from "./routes/delivery";

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api", recipesRouter);
app.use("/api", shoppingListsRouter);
app.use("/api", deliveryRouter);

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

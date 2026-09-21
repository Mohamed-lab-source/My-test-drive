import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 4000),
  // Optional: Google sign-in is disabled (with a clear error) until this is set,
  // rather than failing the whole server's startup like the vars above.
  googleClientId: process.env.GOOGLE_CLIENT_ID,
};

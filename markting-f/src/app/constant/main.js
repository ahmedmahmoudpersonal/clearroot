const client_id =
  process.env.NEXT_PUBLIC_CLIENT_ID || "id-1672549123456-123456";
const noAuthRoutes = [
  "/auth/register",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
];
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const nextUrl = process.env.NEXT_PUBLIC_NEXT_URL || "http://localhost:3000/";

export { client_id, noAuthRoutes, baseURL, nextUrl };

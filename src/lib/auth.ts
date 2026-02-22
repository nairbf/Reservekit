import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { getUserPermissions, type PermissionKey } from "./permissions";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MASTER_ADMIN_EMAIL_ENV = (process.env.MASTER_ADMIN_EMAIL || "").trim();
const MASTER_ADMIN_EMAIL = (MASTER_ADMIN_EMAIL_ENV || "admin@restaurant.com").toLowerCase();
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";

if (process.env.NODE_ENV === "production") {
  if (JWT_SECRET === "dev-secret-change-me") {
    console.error("WARNING: Using default JWT_SECRET in production. Set JWT_SECRET.");
  }
  if (DEFAULT_ADMIN_PASSWORD === "admin123") {
    console.error("WARNING: Using default admin password in production. Set DEFAULT_ADMIN_PASSWORD.");
  }
  if (!MASTER_ADMIN_EMAIL_ENV) {
    console.error("WARNING: MASTER_ADMIN_EMAIL is not set in production. Bootstrap admin creation is disabled.");
  }
}

interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export interface Session {
  userId: number;
  email: string;
  role: string;
  permissions: Set<PermissionKey>;
}

async function ensureBootstrapAdmin() {
  if (process.env.NODE_ENV === "production" && !MASTER_ADMIN_EMAIL_ENV) {
    return;
  }

  const masterAdmin = await prisma.user.findUnique({ where: { email: MASTER_ADMIN_EMAIL } });
  if (masterAdmin) {
    if (masterAdmin.role !== "admin" || !masterAdmin.isActive) {
      await prisma.user.update({
        where: { id: masterAdmin.id },
        data: { role: "admin", isActive: true },
      });
    }
    return;
  }

  const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      email: MASTER_ADMIN_EMAIL,
      passwordHash: hash,
      name: "Admin",
      role: "admin",
      isActive: true,
    },
  });
}

export async function verifyLogin(email: string, password: string) {
  await ensureBootstrapAdmin();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.isActive) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export function createToken(user: { id: number; email: string; role: string }) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

export function createPasswordResetToken(user: { id: number; email: string; passwordHash: string }) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      // Ties the token to the current password hash, so old links stop working after a reset.
      pwdSig: user.passwordHash.slice(-16),
      tokenType: "password_reset",
    },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

export function verifyPasswordResetToken(token: string) {
  const payload = jwt.verify(token, JWT_SECRET) as {
    userId: number;
    email: string;
    pwdSig: string;
    tokenType?: string;
  };
  if (payload.tokenType !== "password_reset") throw new Error("Invalid token");
  return payload;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) return null;

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: getUserPermissions(user.role, user.permissions),
    } satisfies Session;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  if (session.role !== "superadmin") throw new Error("Forbidden");
  return session;
}

export async function requirePermission(permission: PermissionKey) {
  const session = await requireAuth();
  if (!session.permissions.has(permission)) throw new Error("Forbidden");
  return session;
}

export function isMasterAdminEmail(email: string): boolean {
  return String(email || "").trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}

export async function requireMasterAdmin() {
  const session = await requireAuth();
  if (!isMasterAdminEmail(session.email)) throw new Error("Forbidden");
  return session;
}

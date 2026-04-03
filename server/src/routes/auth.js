import { Router } from "express";
import { getAuth, requireAuth } from "@clerk/express";
import User from "../models/user.js";

const router = Router();

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function buildProfileFromClaims(claims = {}) {
  const email = firstNonEmpty([
    claims.email,
    claims.email_address,
    claims.primary_email_address,
    claims?.unsafe_metadata?.email,
    claims?.public_metadata?.email
  ]);

  const fullName = firstNonEmpty([
    claims.name,
    [claims.given_name, claims.family_name].filter(Boolean).join(" "),
    claims.first_name,
    claims.username
  ]);

  return { email, fullName };
}

async function upsertClerkUser(authContext) {
  const { userId, sessionClaims } = authContext;

  if (!userId) {
    throw new Error("Missing Clerk user id");
  }

  const profile = buildProfileFromClaims(sessionClaims);
  const update = {
    clerkId: userId,
    provider: "clerk",
    name: profile.fullName
  };

  if (profile.email) {
    update.email = profile.email.toLowerCase();
  }

  const user = await User.findOneAndUpdate(
    { clerkId: userId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return user;
}

router.get("/me", requireAuth(), async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const user = await upsertClerkUser(auth);

    return res.json({
      ok: true,
      auth: {
        userId: auth.userId,
        sessionId: auth.sessionId
      },
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        roles: user.roles
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/test", requireAuth(), async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const user = await upsertClerkUser(auth);

    return res.json({ ok: true, user: { id: user._id, clerkId: user.clerkId } });
  } catch (error) {
    return next(error);
  }
});

export default router;

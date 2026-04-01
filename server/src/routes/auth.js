import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import User from "../models/user.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, name, provider: "local" });
  const token = signToken(user);

  res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, provider: "local" });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
});

router.get("/test", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (req, res) => {
    const token = signToken(req.user);
    const base = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    const redirectUrl = new URL("/oauth/callback", base);
    redirectUrl.searchParams.set("token", token);
    res.redirect(redirectUrl.toString());
  }
);

export default router;

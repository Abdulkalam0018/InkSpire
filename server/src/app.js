import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import "./config/passport.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

export default app;

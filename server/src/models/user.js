import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    name: { type: String },
    provider: { type: String, enum: ["local", "google"], default: "local" },
    providerId: { type: String },
    roles: [{ type: String, default: "user" }]
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

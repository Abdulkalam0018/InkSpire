import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    name: { type: String },
    provider: { type: String, enum: ["clerk", "local", "google"], default: "clerk" },
    providerId: { type: String },
    roles: [{ type: String, default: "user" }]
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

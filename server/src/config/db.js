import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbname = process.env.DB_NAME;

  if (!uri) {
    throw new Error("MONGODB_URI is missing");
  }

  const connectionUri = dbname ? `${uri}/${dbname}` : uri;
  await mongoose.connect(connectionUri);
  console.log("MongoDB connected");
}

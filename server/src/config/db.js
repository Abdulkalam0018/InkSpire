import mongoose from "mongoose";

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    const dbname = process.env.DB_NAME;
    if (!uri) {
      throw new Error("MONGODB_URI is missing");
    }
    await mongoose.connect(`${uri}/${dbname}`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
  console.log("MongoDB connected");
}

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        let user = await User.findOne({ provider: "google", providerId: profile.id });

        if (!user) {
          user = await User.create({
            provider: "google",
            providerId: profile.id,
            email,
            name: profile.displayName
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

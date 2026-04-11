import { verifyToken } from "@clerk/express";
import User from "../models/user.js";

function firstNonEmpty(values = []) {
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
		claims?.public_metadata?.email,
	]);

	const fullName = firstNonEmpty([
		claims.name,
		[claims.given_name, claims.family_name].filter(Boolean).join(" "),
		claims.first_name,
		claims.username,
	]);
    
	return { email, fullName };
}

function extractToken(socket) {
	const authToken = socket.handshake?.auth?.token;

	if (typeof authToken === "string" && authToken.trim().length > 0) {
		return authToken.trim();
	}

	const headerValue =
		socket.handshake?.headers?.authorization ||
		socket.handshake?.headers?.Authorization;

	if (typeof headerValue === "string" && headerValue.trim().length > 0) {
		const match = headerValue.match(/^Bearer\s+(.+)$/i);
		return match ? match[1].trim() : headerValue.trim();
	}

	const queryToken = socket.handshake?.query?.token;
	if (typeof queryToken === "string" && queryToken.trim().length > 0) {
		return queryToken.trim();
	}

	return undefined;
}

function buildUnauthorizedError(message, details) {
	const error = new Error(message);
	error.data = {
		code: "SOCKET_UNAUTHORIZED",
		status: 401,
		...(details ? { details } : {}),
	};

	return error;
}

async function upsertSocketUser(userId, sessionClaims) {
	const profile = buildProfileFromClaims(sessionClaims);
	const update = {
		clerkId: userId,
		provider: "clerk",
		name: profile.fullName,
	};

	if (profile.email) {
		update.email = profile.email.toLowerCase();
	}

	return User.findOneAndUpdate(
		{ clerkId: userId },
		{ $set: update },
		{ upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
	);
}

export default async function socketAuth(socket, next) {
	try {
		const token = extractToken(socket);

		if (!token) {
			return next(buildUnauthorizedError("Missing authentication token"));
		}

		const verifiedClaims = await verifyToken(token, {
			secretKey: process.env.CLERK_SECRET_KEY,
			clockSkewInMs: 20000
		});

		const userId = verifiedClaims?.sub;

		if (!userId) {
			return next(buildUnauthorizedError("Invalid token payload", "Missing sub claim"));
		}

		const user = await upsertSocketUser(userId, verifiedClaims);

		socket.auth = {
			userId,
			sessionId: verifiedClaims?.sid,
			claims: verifiedClaims,
		};
		socket.user = user;

		return next();
	} catch (error) {
		const message = error?.message || "Socket authentication failed";
		return next(buildUnauthorizedError("Authentication failed", message));
	}
}

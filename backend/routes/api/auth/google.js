import { PrismaClient } from '../../../generated/prisma/index.js';
import crypto from 'crypto'; // Built-in Node module to generate random passwords
import bcrypt from "bcrypt";
import {
	establishSession,
	findActiveRemoteMatch,
	getTakeoverConflict,
	signSessionToken,
} from "../../../services/session-service.js";

const prisma = new PrismaClient();

// Route: Google Authentication Callback
// After users log in Google's page, Google redirects them back here with a "AUTHORIZATION CODE"
// 		We exchange the CODE for a TOKEN, get their email, and log them in
// This route handles the response from Google after the user grants permission.

export default async function (fastify, opts) {
	// Google calls this route after user sign in
	fastify.get('/google/callback', async function (request, reply) {
		const publicAppUrl =
			process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://localhost:8443';
		
		try {
			// 1. Exchange the temporary CODE from Google for an ACCESS TOKEN
			// This TOKEN proves we are allowed to read the user's info.
			const token = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

			// 2. Use the TOKEN to fetch the user's details from Google API
			const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: {
					Authorization: 'Bearer ' + token.token.access_token
				}
			});
			const userData = await userResponse.json();

			// 3. Check if we successfully get the email
			if (!userData.email) {
				return (reply.code(400).send({ error: "Google account has no email" }));
			}

			// 4. Check if this user exist in our database
			let profile = await prisma.profile.findUnique({
				where: { email: userData.email }
			});

			// 5. If user does NOT exist, we register them automatically
			if (!profile) {
				// Generate a random password because they will use Google to login,
				// but our DB schema requires a password string.
				const pepper = process.env.SECURITY_PEPPER;
				const saltRounds = parseInt(process.env.SALT_ROUNDS);
				const randomPassword = crypto.randomBytes(32).toString("hex");
				const passwordWithPepper = randomPassword + pepper;
				const passwordHash = await bcrypt.hash(passwordWithPepper, saltRounds);
				
				// We create the User and Profile in one transaction
				const newUser = await prisma.user.create({
					data: {
						password: passwordHash, // Store the hash
						profile: {
							create: {
								email: userData.email,
								username: userData.email.split('@')[0], // Use email prefix as username
								fullname: userData.name || "Google User",
								avatar: userData.picture || "", // Use Google avatar if available
								dob: userData.dob || null,
								region: userData.region || null,
							}
						}
					},
					include: {
						profile: true
					}
				});
				
				profile = newUser.profile;
			}

			const user = await prisma.user.findUnique({
				where: { id: profile.id },
			});
			if (!user) {
				return reply.code(500).send({ error: "User not found" });
			}

			const cookieOptions = {
				path: "/",
				secure: true,
				httpOnly: true,
				sameSite: true,
			};

			// 6. Match login.js: require TOTP when 2FA is enabled
			if (user.twoFA) {
				const tempToken = fastify.jwt.temp.sign(
					{ userId: profile.id, purpose: "2fa", takeover: false },
					{ expiresIn: "5m" }
				);
				reply.setCookie("token", tempToken, {
					...cookieOptions,
					maxAge: 300,
				});
				return reply.redirect(`${publicAppUrl}/2fa/verify`);
			}

			const activeMatch = findActiveRemoteMatch(fastify, user.id);
			const takeoverConflict = getTakeoverConflict(fastify, user.id);
			if (takeoverConflict) {
				const tempToken = fastify.jwt.temp.sign(
					{ userId: profile.id, purpose: "oauth-takeover" },
					{ expiresIn: "5m" },
				);
				reply.setCookie("token", tempToken, {
					...cookieOptions,
					maxAge: 300,
				});
				return reply.redirect(`${publicAppUrl}/login?oauthTakeover=1`);
			}

			const sessionVersion = await establishSession(fastify, prisma, user.id);
			const appToken = signSessionToken(fastify, profile.id, sessionVersion);

			// 7. Set the cookie and redirect to the frontend dashboard
			reply.setCookie("token", appToken, {
				...cookieOptions,
				maxAge: 3600,
			});

			return reply.redirect(
				activeMatch?.matchId
					? `${publicAppUrl}/game/${activeMatch.matchId}`
					: `${publicAppUrl}/dashboard`,
			);
		} catch (error) {
			console.error("Google Auth Error: ", error);
			return (reply.code(500).send({ error: "Authentication failed" }));
		}
	});
}

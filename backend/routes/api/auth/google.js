import { PrismaClient } from '../../../generated/prisma/index.js';
import crypto from 'crypto';
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const NGROK_URL = process.env.APP_URL || 'https://unmachineable-rosalba-grievingly.ngrok-free.dev';
const LOCAL_URL = 'https://localhost:8443';

function getBaseUrl(request) {
	const host = request.headers['x-forwarded-host'] || request.headers.host || '';
	return host.includes('ngrok') ? NGROK_URL : LOCAL_URL;
}

export default async function (fastify, opts) {

	// Custom login route — redirects to Google with the correct redirect_uri for this host
	fastify.get('/google/login', async function (request, reply) {
		const baseUrl = getBaseUrl(request);
		const callbackUri = `${baseUrl}/api/auth/google/callback`;
		const authUri = fastify.googleOAuth2.generateAuthorizationUri(request, reply, {
			redirect_uri: callbackUri,
		});
		return reply.redirect(authUri);
	});

	// Google redirects here after user approves
	fastify.get('/google/callback', async function (request, reply) {
		const baseUrl = getBaseUrl(request);

		try {
			// Exchange code for token (uses the registered callbackUri from the plugin)
			const token = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

			// Fetch user info from Google
			const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: 'Bearer ' + token.token.access_token }
			});
			const userData = await userResponse.json();

			if (!userData.email) {
				return reply.code(400).send({ error: "Google account has no email" });
			}

			// Find or create user
			let profile = await prisma.profile.findUnique({
				where: { email: userData.email }
			});

			if (!profile) {
				const pepper = process.env.SECURITY_PEPPER;
				const saltRounds = parseInt(process.env.SALT_ROUNDS);
				const randomPassword = crypto.randomBytes(32).toString("hex");
				const passwordHash = await bcrypt.hash(randomPassword + pepper, saltRounds);

				const newUser = await prisma.user.create({
					data: {
						password: passwordHash,
						profile: {
							create: {
								email: userData.email,
								username: userData.email.split('@')[0],
								fullname: userData.name || "Google User",
								avatar: userData.picture || "",
								dob: null,
								region: null,
							}
						}
					},
					include: { profile: true }
				});

				profile = newUser.profile;
			}

			const appToken = fastify.jwt.sign(
				{ userId: profile.id },
				{ expiresIn: "1h" }
			);

			reply.setCookie("token", appToken, {
				path: "/",
				secure: true,
				httpOnly: true,
				sameSite: "none",
				maxAge: 3600,
			});

			return reply.redirect(`${baseUrl}/dashboard`);
		} catch (error) {
			console.error("Google Auth Error: ", error);
			return reply.code(500).send({ error: "Authentication failed" });
		}
	});
}

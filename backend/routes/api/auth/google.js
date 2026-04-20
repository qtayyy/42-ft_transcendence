import { PrismaClient } from '../../../generated/prisma/index.js';
import crypto from 'crypto';
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

/**
 * Detect the origin the user is connecting from.
 * Used only for post-auth redirect — not for the OAuth callback URI
 * (that is handled dynamically by the plugin via resolveCallbackUri).
 */
function getRequestOrigin(request) {
	const host = request.headers['x-forwarded-host'] || request.headers['host'] || '';

	if (host.includes('ngrok')) {
		return process.env.APP_URL || `https://${host}`;
	}

	const lanIp = process.env.HOST_IP;
	if (lanIp && host.includes(lanIp)) {
		return `https://${lanIp}:8443`;
	}

	return 'https://localhost:8443';
}

export default async function (fastify, opts) {

	// Step 1 — redirect user to Google
	fastify.get('/google/login', async function (request, reply) {
		const origin = getRequestOrigin(request);
		const host = request.headers['x-forwarded-host'] || request.headers['host'] || '';
		console.log('[Google OAuth] login — host:', host, '| origin:', origin);

		// Store the user's origin in a short-lived cookie so we can
		// redirect them back to the right place after auth completes.
		reply.setCookie('oauth_origin', origin, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'none',
			maxAge: 300,
		});

		// No 3rd argument — v8.1.2 treats a 3rd arg as a callback function.
		// The callbackUri is resolved dynamically by the plugin (see plugins/oauth.js).
		const authUri = await fastify.googleOAuth2.generateAuthorizationUri(request, reply);
		return reply.redirect(authUri);
	});

	// Step 2 — Google redirects back here after user approves
	fastify.get('/google/callback', async function (request, reply) {
		const redirectOrigin = request.cookies?.oauth_origin || getRequestOrigin(request);
		reply.clearCookie('oauth_origin', { path: '/' });

		try {
			// No 3rd argument — plugin uses the same resolveCallbackUri function
			// for token exchange, so redirect_uri always matches.
			const token = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request, reply);

			const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: 'Bearer ' + token.token.access_token },
			});
			const userData = await userResponse.json();

			if (!userData.email) {
				return reply.code(400).send({ error: "Google account has no email" });
			}

			let profile = await prisma.profile.findUnique({
				where: { email: userData.email },
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
							},
						},
					},
					include: { profile: true },
				});

				profile = newUser.profile;
			}

			const appToken = fastify.jwt.sign(
				{ userId: profile.id },
				{ expiresIn: "1h" },
			);

			reply.setCookie("token", appToken, {
				path: "/",
				secure: true,
				httpOnly: true,
				sameSite: "none",
				maxAge: 3600,
			});

			return reply.redirect(`${redirectOrigin}/dashboard`);

		} catch (error) {
			console.error("Google Auth Error:", error);
			return reply.redirect(`${redirectOrigin}/login?error=oauth_failed`);
		}
	});
}

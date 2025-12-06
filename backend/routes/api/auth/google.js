import { PrismaClient } from '../../../generated/prisma/index.js';
import crypto from 'crypto'; // Built-in Node module to generate random passwords

const prisma = new PrismaClient();

// Route: Google Authentication Callback
// After users log in Google's page, Google redirects them back here with a "AUTHORIZATION CODE"
// 		We exchange the CODE for a TOKEN, get their email, and log them in
// This route handles the response from Google after the user grants permission.

export default async function (fastify, opts) {
	// Google calls this route after user sign in
	fastify.get('/google/callback', async function (request, reply) {
		
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
				const randomPassword = crypto.randomBytes(16).toString('hex');
				
				// We create the User and Profile in one transaction
				const newUser = await prisma.user.create({
					data: {
						password: randomPassword, // Dummy password
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

			// 6. Generate our own JWT token for the session
			// We need to match logic that used in login.js
			const appToken = fastify.jwt.sign(
				{ userId: profile.id },
				{ expiresIn: "1h" }
			);

			// 7. Set the cookie and redirect to the frontend dashboard
			// We use a redirect here because this is a browser navigation, not an AJAX call
			reply.setCookie("token", appToken, {
				path: "/",
				secure: true, // for HTTPS 
				httpOnly: true,
				sameSite: 'Strict', // Safer settings
				maxAge: 3600,
			});

			// Redirect user back to the frontend
			return (reply.redirect('https://localhost:8443/dashboard'));
		} catch (error) {
			console.error("Google Auth Error: ", error);
			return (reply.code(500).send({ error: "Authentication failed" }));
		}
	});
}
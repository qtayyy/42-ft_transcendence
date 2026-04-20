import fp from 'fastify-plugin';
import oauth2 from '@fastify/oauth2';

// The OAuth callback URI sent to Google must match exactly what is registered
// in Google Cloud Console. We use APP_URL from .env as the canonical base.
//
// Supported modes (change APP_URL in backend/.env and rebuild):
//   localhost  →  APP_URL=https://localhost:8443        (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
//   ngrok      →  APP_URL=https://<subdomain>.ngrok-free.app  (GOOGLE_CLIENT_ID_DEV / GOOGLE_CLIENT_SECRET_DEV)
//
// LAN mode (192.168.x.x) is NOT supported for Google OAuth —
// Google blocks private IP addresses as redirect URIs.
const APP_URL = process.env.APP_URL || 'https://localhost:8443';
const CANONICAL_CALLBACK = `${APP_URL}/api/auth/google/callback`;

// Use the dev client ID when running on ngrok, otherwise use the production one.
const IS_NGROK = APP_URL.includes('ngrok');
const CLIENT_ID = IS_NGROK
	? (process.env.GOOGLE_CLIENT_ID_DEV || process.env.GOOGLE_CLIENT_ID)
	: process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = IS_NGROK
	? (process.env.GOOGLE_CLIENT_SECRET_DEV || process.env.GOOGLE_CLIENT_SECRET)
	: process.env.GOOGLE_CLIENT_SECRET;

export default fp(async function(fastify, opts) {
	if (!CLIENT_ID || !CLIENT_SECRET) {
		console.error('Missing Google OAuth credentials');
		return;
	}

	console.log('[Google OAuth] mode:', IS_NGROK ? 'ngrok (dev)' : 'localhost/LAN');
	console.log('[Google OAuth] callbackUri:', CANONICAL_CALLBACK);

	fastify.register(oauth2, {
		name: 'googleOAuth2',
		scope: ['profile', 'email'],
		credentials: {
			client: {
				id: CLIENT_ID,
				secret: CLIENT_SECRET,
			},
			auth: oauth2.GOOGLE_CONFIGURATION,
		},
		callbackUri: CANONICAL_CALLBACK,
	});
});

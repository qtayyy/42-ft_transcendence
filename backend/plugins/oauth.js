import fp from 'fastify-plugin';
import oauth2 from '@fastify/oauth2';
import fastify from 'fastify';

// Plugin : OAuth2 Configuration
// Register plugin so Fastify knows how to talk to Google
// This plugin configures the OAuth2 provider (Google) for the application.
// It sets up the credentials and the callback URL that Google will return to.

export default fp(async function(fastify, opts) {
	// Check if environment variables are present to avoid crashes later
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
		// If keys are missing, we log an error but don't crash, 
		// though auth won't work.
		console.error('Missing Google OAuth credentials');
		return;
	}

	// Register the @fastify/oauth2 plugin
	fastify.register(oauth2, {
		name: 'googleOAuth2',  // used to reference provider
		scope: ['profile', 'email'], // ask Google for user's profile and email
		credentials: {
			client: {
				id: process.env.GOOGLE_CLIENT_ID,
				secret: process.env.GOOGLE_CLIENT_SECRET
			},
			auth: oauth2.GOOGLE_CONFIGURATION, // Helper object with google's specific URLs
		},
		// Match whatever in Google Cloud Console
		startRedirectPath: '/api/auth/google/login', // URL to start login
		callbackUri: 'https://localhost:8443/api/auth/google/callback', // this is public Nginx address
	});
});
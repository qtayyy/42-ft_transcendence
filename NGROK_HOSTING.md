# ngrok Hosting Cheat Sheet

Use this when you want to expose the local `42-ft_transcendence` app publicly for short-term demos or testing.

## Start Hosting

From the repo root:

```bash
make start
```

In another terminal:

```bash
make ngrok
```

ngrok will print a public URL like:

```text
https://example-name.ngrok-free.dev
```

Copy that URL and update [backend/.env](/home/pc/42-ft_transcendence/backend/.env):

```env
PUBLIC_APP_URL=https://example-name.ngrok-free.dev
```

Then recreate the backend so it picks up the updated environment:

```bash
make ngrok-restart-backend
```

Now open the ngrok URL in your browser.

### Faster option

If ngrok is already running, you can automate the `.env` update and backend recreate:

```bash
make ngrok-sync
```

This will:

- read the current HTTPS tunnel from the local ngrok API
- update `PUBLIC_APP_URL` in `backend/.env`
- print the exact Google OAuth callback URL
- recreate the backend container

## Google OAuth

If you want Google sign-in to work, update the Google OAuth redirect URI to:

```text
https://example-name.ngrok-free.dev/api/auth/google/callback
```

Important:

- The ngrok free URL may change every time you start ngrok.
- If it changes, update both `PUBLIC_APP_URL` and the Google redirect URI again.

## Stop Hosting

In the terminal running ngrok, press `Ctrl+C`.

Then stop the local app:

```bash
make down
```

## Quick Summary

```text
make start
make ngrok
make ngrok-sync
update Google redirect URI if needed
```

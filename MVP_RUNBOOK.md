# MVP release runbook

## 1. Secrets

1. Revoke the currently exposed OpenRouter key in OpenRouter and create a replacement.
2. Generate a new JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Copy `backend/.env.example` to `backend/.env` and fill in local values.
4. For production set `NODE_ENV=production`, `JWT_SECRET`, `OPENROUTER_API_KEY`, and `ALLOWED_ORIGINS`.
5. Never log or commit `.env`, API keys, JWTs, or database backups.

## 2. Data release gate

The current admission statistics are synthetic and marked `demo/manual estimate`. They must be replaced with data from official university or government sources before release.

Run the gate after importing verified data:

```powershell
$env:ACADEMIC_YEAR = '2026-2027'
npm run db:audit
```

The gate fails when requirements or grants contain another year, when admission statistics contain demo/manual sources, or when SQLite integrity fails.

## 3. Database backup and rollback

Create a verified backup before every data migration:

```powershell
npm run db:backup
```

Restore a specific backup only after stopping the server:

```powershell
npm run db:rollback -- backend/backups/edumatch-YYYY-MM-DDTHH-MM-SS-sssZ.db
```

The rollback command keeps a `before-rollback-*.db` safety copy and verifies SQLite integrity after restoring.

## 4. Deployment checklist

- Configure a domain and TLS certificate at the hosting/reverse-proxy layer.
- Set `NODE_ENV=production` and the production `ALLOWED_ORIGINS` value.
- Run `npm install --omit=dev` in the deployment environment.
- Run `npm run db:audit` and `npm test`.
- Start the service with a process manager and configure automatic restart.
- Verify `GET /health` returns JSON status `ok` over HTTPS.
- Schedule daily backups and retain multiple generations off the application host.

## 5. Manual E2E acceptance

Test in desktop and mobile viewports:

- register, login, logout, profile, favorites;
- university search, filters, comparison, grants, map;
- admission calculation and history;
- AI conversations in Russian, Kazakh, and English with the real OpenRouter key;
- invalid input, expired session, network failure, and AI fallback behavior.

A full admin panel is outside the MVP scope. Academic-year and data changes remain an authenticated manual operation until an admin UI is implemented.

# Dev Auth Accounts

Single source of truth for local dev/test logins.

## Important

- Seeded users are stored in `oltp.users`.
- There is no hardcoded password in backend code.
- Password login works only when:
  - user has `password_hash` (registered via `/auth/register`), or
  - email is in `DEV_BYPASS_EMAILS` and `DEV_BYPASS_PASSWORD` is set.

## Recommended `backend/.env` settings

**Option A — password login (no OTP):**

```env
DEV_BYPASS_EMAILS=admin@nextstay.com,owner.c2@nextstay.com,staff.uborka@yandex.com,uborka.staff@yandex.com,nextstay@yandex.com
DEV_BYPASS_PASSWORD=AtaiDairTurat
```

**Option B — OTP login without Brevo (OTP in backend console):**

```env
DEV_OTP_LOG_TO_CONSOLE=true
```

Then request OTP in the app; the code will appear in the terminal where the backend is running. Use that code to log in.

## Seeded accounts (local DB)

- `admin@nextstay.com`
  - Role: `OWNER`
  - Company: `C1`
  - Auth: OTP by default, or password if included in `DEV_BYPASS_EMAILS`
- `owner.c2@nextstay.com`
  - Role: `OWNER`
  - Company: `C2`
  - Auth: OTP by default, or password if included in `DEV_BYPASS_EMAILS`
- `nextstay@yandex.com`
  - Role: `OWNER`
  - Company: `C2`
  - Auth: OTP by default, or password if included in `DEV_BYPASS_EMAILS`
- `staff.uborka@yandex.com`
  - Role: `STAFF`
  - Company: `C1`
  - Auth: OTP by default, or password if included in `DEV_BYPASS_EMAILS`
- `uborka.staff@yandex.com`
  - Role: `STAFF`
  - Company: `C2`
  - Auth: OTP by default, or password if included in `DEV_BYPASS_EMAILS`

## Quick checks

```bash
# show seeded users with company scope
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay -c "SELECT email, role, company_code FROM oltp.users ORDER BY email;"
```

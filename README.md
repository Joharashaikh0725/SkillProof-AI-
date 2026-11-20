# SkillProof AI: full-stack setup (step by step)

**Frontend:** HTML, CSS, JavaScript (`frontend/`)  **Backend:** Python + FastAPI (`backend/`)  **Database + login:** Supabase

```
Browser (frontend) --login, reports--> Supabase
Browser (frontend) --AI requests + login token--> Python backend --> Claude API
                                                       |
                                                       +-- checks the token with Supabase
```
The Claude API key lives ONLY in `backend/.env`. The browser never sees it.

## Project structure
```
skillproof-fullstack/
  README.md                 <- this guide
  supabase.sql              <- database tables + security rules (run once in Supabase)
  backend/                  <- Python (FastAPI)
    main.py                 <- endpoints, login check, rate limit
    ai.py                   <- Claude prompts + score checking
    requirements.txt  .env.example  .gitignore
    tests/test_api.py       <- 8 tests (run: pytest)
  frontend/                 <- HTML, CSS, JavaScript
    index.html  style.css  script.js  config.js
  demo/skillproof-ai.html   <- single file, open directly: works with NO setup (data stays in the browser)
```

If you skip Steps 1 to 5, the frontend still works in demo mode (data stays in the browser, built-in feedback).

---
## Step 1. Install the tools
- Python 3.11 or newer (python.org). On Windows tick "Add Python to PATH".
- VS Code (code.visualstudio.com).
- Check: `python --version`

## Step 2. Supabase (database + login)
1. supabase.com -> New project (remember the database password).
2. SQL Editor -> New query -> paste everything from `supabase.sql` -> Run. (Run it only once.)
3. Keep email confirmation ON (Authentication -> Sign In / Providers -> Email -> "Confirm email"). Then tell Supabase where the link should open:
   Authentication -> URL Configuration -> **Site URL** = `http://127.0.0.1:5500` and add to **Redirect URLs**: `http://127.0.0.1:5500/**` and `http://localhost:5500/**` (add your online address too after Step 7).
   **Important:** Supabase's built-in email sender only delivers to members of your Supabase project team (everyone else gets "Email address not authorized") and is very limited per hour. For your own testing use the email of your Supabase account. For real users set up custom SMTP: Authentication -> Emails -> SMTP Settings -> Enable custom SMTP (Brevo, Resend or Gmail SMTP with an app password all work).
4. Settings -> API: copy the **Project URL** and the **anon public** key.
5. Table Editor: you should now see `profiles` and `reports`.

## Step 3. Claude API key
1. console.anthropic.com -> API Keys -> Create key. Add a few dollars of credit (the API is billed separately from a Claude chat subscription).
2. Copy the key (starts with `sk-ant-`).

## Step 4. Run the Python backend
Open a terminal in the `backend` folder:
```
python -m venv .venv
.venv\Scripts\activate            # Windows PowerShell   (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # Mac/Linux: cp .env.example .env
```
Open `.env` and fill in `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Then:
```
uvicorn main:app --reload
```
- Open http://127.0.0.1:8000/health -> you should see `"ai_configured": true, "auth_configured": true`.
- Open http://127.0.0.1:8000/docs to see the endpoints.
- Run the tests: `pytest` (8 should pass).
- If PowerShell blocks activation: `Set-ExecutionPolicy -Scope Process Bypass`, then activate again.

## Step 5. Connect and run the frontend
1. Open `frontend/config.js` and paste your Supabase URL and anon key. Keep `API_URL` as `http://127.0.0.1:8000`.
2. New terminal in the `frontend` folder:
```
python -m http.server 5500
```
3. Open http://127.0.0.1:5500 (not by double-clicking the file).

## Step 6. Test everything
1. Create an account. A "Check your email" popup appears. Click the link in the email (check spam): you land back in the app already logged in. In Supabase -> Table Editor -> `profiles` your row appears.
2. Do one challenge. In the interview you should see "Claude AI is your interviewer".
3. After the report, Table Editor -> `reports` has a new row. The report says "Scored by Claude AI".
4. Reports -> open a report -> **Share link** -> open the link in a private window: the report shows without login.
5. Log out and log in on another browser: your reports are still there.

## Step 7. Put it online (free tiers)
**Backend on Render (render.com):** New -> Web Service -> connect your GitHub repo, root directory `backend`.
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment: add the same variables as `.env`, and set `ALLOWED_ORIGINS` to your frontend address.

**Frontend on Netlify (netlify.com):** drag the `frontend` folder onto Netlify Drop. Before that, put your Render address in `config.js` as `API_URL`.

**Supabase:** Authentication -> URL Configuration -> set Site URL to your Netlify address and add `https://your-site.netlify.app/**` to Redirect URLs.

## Where things are
| What | File |
|---|---|
| Claude prompts, score checking (evidence must be a real quote, usability stays near test numbers) | `backend/ai.py` |
| Endpoints, login check, rate limit | `backend/main.py` |
| Tables and security rules | `supabase.sql` |
| Login, saving reports, sharing, AI calls from the browser | `frontend/script.js` |

## Troubleshooting
| Problem | Fix |
|---|---|
| Page shows only a "SkillProof AI" link and a menu button, no design | You opened `index.html` alone or from inside the zip. Extract the zip fully and keep `index.html`, `style.css`, `script.js` and `config.js` in the SAME folder (or just open `demo/skillproof-ai.html`, it is one file) |
| Browser console: CORS error | Add your frontend address to `ALLOWED_ORIGINS` in `.env` and restart uvicorn |
| "Invalid API key" / 502 | Check `ANTHROPIC_API_KEY`; see logs in the uvicorn terminal. If the model name is rejected, set `CLAUDE_MODEL_SMART` / `CLAUDE_MODEL_QUICK` in `.env` (names: docs.claude.com) |
| Sign-up says "Email address not authorized" | Supabase default email only sends to your project team. Use your own account email for testing, or set up custom SMTP (Step 2.3) |
| Confirmation email never arrives | Check spam; use "Resend email" in the popup; the default sender allows only a few emails per hour (custom SMTP fixes this) |
| Confirmation link opens a dead page (localhost:3000) | Set Site URL and Redirect URLs in Authentication -> URL Configuration (Step 2.3) |
| "Email not confirmed" when logging in | Click the link in the confirmation email first, or use "Resend email" |
| Report says "Scored with built-in rules" | AI call failed: check the backend terminal; also check you are logged in |
| Reports do not save | Did you run `supabase.sql` completely? Check the browser console for the error text |
| `supabase` is not defined | The CDN script did not load. Check your internet or use `@supabase/supabase-js@2` in `index.html` |

## Security checklist
- Never put `ANTHROPIC_API_KEY` in the frontend or on GitHub (`.env` is in `.gitignore`).
- Use only the **anon** Supabase key in the frontend, never the `service_role` key.
- Keep Row Level Security ON (the SQL does it). Each user can read only their own reports, plus reports they chose to share.
- A report you click "Share link" on can be read by anyone who has the link (the database also allows listing shared reports). Share only what you are happy to make public, and use "Stop sharing" to take it back.
- `AI_CALLS_PER_HOUR` limits how much one user can spend. Set a monthly spending limit in the Anthropic console too.

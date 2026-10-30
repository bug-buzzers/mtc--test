# Maples Tech Club exam portal

A Next.js exam portal for students in Classes 6–12 and their teachers. Students register using their name, school roll number, class, section and a password. Teachers manage a private question bank, configure exam windows, review interruptions, and publish results. A student's dashboard shows active classmates' **names only**, limited to the same class and section/stream.

## Important security cutover

The earlier repository was public and included question/answer files, student records and demo credentials. Removing those files from the current checkout **does not remove them from Git history, forks, caches, or copies**. Treat the entire old bank and all previously published credentials as compromised; never reuse them for an exam. Review the exposure of student records and rotate any secrets that were exposed, including JWT or database credentials if applicable.

`supabase/schema.sql` is an idempotent schema and one-time security migration. **Back up the database and rehearse the upgrade on a staging copy before applying it.** On its first application it:

- disables existing administrators, students, old questions and active sessions; closes exam windows and hides results;
- marks old student passwords as requiring reset before reactivation;
- retires unfinished legacy papers (they remain in the database but cannot be resumed or consume a new attempt); and
- preserves historical students, questions, responses and completed results, with best-effort snapshots of the old records.

The obsolete `public.student_attempt_summaries` view is dropped because its owner privileges could bypass callers' RLS. The app obtains summaries through its server instead. If another integration needs a view, design appropriate RLS and grants first and use a `security_invoker` view on PostgreSQL 15+, rather than restoring an owner-privileged public view.

It also replaces policies on the app's tables, enables row-level security and revokes direct anonymous/authenticated access. Review any other integrations that depend on those policies. Reapplying the script does **not** repeat the security cutover or reseed the database. For local development data the app creates a `.pre-security-backup` before a one-time upgrade; protect that file because it can contain sensitive information.

## Published temporary legacy seed

`supabase/legacy-756-question-seed.sql` contains 756 revised legacy questions (108 per class) **and their answer key**. It is public and compromised. Do not use it for a secure or high-stakes exam; replace it with a newly written private bank. More balanced option lengths reduce one clue but do not guarantee fairness or factual accuracy, so have a teacher review the questions.

To use this temporary bank, apply the complete `supabase/schema.sql` first, then run the seed as the database owner. The security migration deactivates generation-1 legacy rows; the seed inserts active generation-2 copies. If an earlier seed is already active, it updates only exact, unedited originals. Teacher-edited or inactive rows are not overwritten, unrelated questions are left alone, and existing attempt snapshots remain unchanged. The script is safe to rerun. Its final per-class report lists `expected`, `revised_ready`, `needs_review`, and `other_active_matches`; review nonzero values before opening an exam.

## Production setup

1. Use Node.js 20.9 or later (Node 22 recommended) and run `npm ci`. Provision a Supabase project and back up any existing data.
2. Apply the complete `supabase/schema.sql` as the database owner using the Supabase SQL editor or your normal migration tooling. For an existing installation that already has the security schema, apply `supabase/admin-password-migration.sql` before deploying the admin password update. Test it against a staging copy first. The no-code registration API requires the updated registration function in this schema; deploy the schema and app together (registration can be unavailable between those steps). Old invite records are preserved but are no longer used. Apply it to each target project; updating a repository alone does not update a hosted database.
3. Set these environment variables in the server's secret manager or a gitignored `.env.local` file. See `.env.example`; do not send secrets in chat or put them in client-side `NEXT_PUBLIC_` variables.

   - `SUPABASE_URL`: your project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role key; protect it like a database password.
   - `JWT_SECRET`: a newly generated random secret of at least 32 bytes. For example, generate one locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and store it securely.

   Production fails closed without Supabase and a valid JWT secret. Never expose the service-role key to a browser. Use HTTPS and a reverse proxy that sanitizes forwarded host, protocol and IP headers. Configure backups, access controls and monitoring for the hosted database.
4. Create or rotate an administrator **after** the migration from a trusted shell with the same server-side database environment. This creates the account or updates the named account and revokes its previous sessions. There is no default administrator or password. For example, in Bash:

   ```bash
   read -r -p 'Administrator username: ' MTC_ADMIN_USERNAME
   read -rs -p 'New administrator password: ' MTC_ADMIN_PASSWORD; printf '\n'
   export MTC_ADMIN_USERNAME MTC_ADMIN_PASSWORD
   npm run create-admin
   unset MTC_ADMIN_USERNAME MTC_ADMIN_PASSWORD
   ```

   Use a unique password of at least 12 characters (at most 72 UTF-8 bytes). Set `MTC_ADMIN_FULL_NAME` if desired. Do not put passwords on a command line, in source files, or in shell history. Distribute account credentials through a private channel. Once signed in, use **Account → Change password** to change your own password. The page can generate a strong password on your device; save it securely before submitting. Your current password is required and all your sessions are revoked after the change.
5. Sign in at `/admin/login`. For each retained student, reset their password in **Students** before reactivating them; activation is rejected until reset. New students can register with their name, school roll number, class, section or stream, and password. They can generate a unique password on the registration page or use a password manager; they must save it before submitting. Passwords generated by the page use the browser's cryptographically secure random generator, but are not checked against breach databases. Chrome's independent breach warnings remain enabled; if one appears before registration, choose another password. If the account was already created, ask a teacher to reset the password in **Students**. Alternatively, a teacher can create a student account directly and share its initial password privately. **Registration no longer verifies identity:** anyone who knows an unused roll number, class and section can claim it. Rate limits do not prevent impersonation. Teachers should verify the roster and deactivate suspicious accounts; restrict access to trusted students or add identity verification before production if needed.
6. In **Question bank**, add or privately import a replacement bank. The active bank is empty after cutover unless the optional exposed legacy seed has also been run. The CSV importer accepts up to 500 rows per import, with an optional header in this order:

   ```text
   class,subject_tag,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option
   ```

   Classes are 6–12; difficulty is `easy`, `medium` or `hard`; correct option is `a`, `b`, `c` or `d`. Quote fields containing commas and escape quotes by doubling them. Each question must occupy one line. Keep source CSV files and answer keys in private storage, never in this repository. Staff can search, filter, sort, edit, deactivate and page through the bank.

   After importing, review the reported option-length counts. In **Length review**, choose **Correct answer among longest** to find questions where the correct option is longest by words or characters, including ties when some options are shorter. **Uneven option lengths** finds substantial length differences regardless of the key. The filters scan the full active private bank before pagination (large Supabase banks may take longer); other filters still apply. Open a question to see live word and character counts. Rewrite incorrect options to be plausible and similarly detailed without changing the intended correct answer, then verify the whole question for subject accuracy. These checks are advisory, use approximate word/character counts and do not automatically rewrite or establish fairness. Existing exam snapshots are not changed.
7. Configure each class's question count, passing score, duration and attempt limit in **Settings**. Each active bank must have at least as many questions as the configured paper. Open a class's exam window only when it is ready. Settings and question wording/options/keys are snapshotted when a paper starts, so later edits do not change an existing paper or its grade.
8. Review locked attempts under **Integrity** and unlock only after checking the circumstances. Students must resume promptly after unlock; their preserved remaining time is restored with at least one minute to reconnect. Publish class results from **Settings** only after that class has finished: publishing makes the scorecard, selected answers and correct answers visible to students. Results can be hidden again.

## Exam behavior and limitations

- Students must acknowledge the rules and enter full screen from a button click. The first detected tab switch warns; another tab switch, a detected full-screen exit or a reported quit locks the attempt. A missed heartbeat for more than 60 seconds before the deadline also locks it. An administrator can review and unlock. Browser focus changes caused by phone calls, accessibility tools, connection loss, crashes or other interruptions can create false positives.
- A web page **cannot make an exam cheat-proof**, prevent every exit, detect another device, or guarantee a notification when a tab/browser/device closes or the network fails. Close/refresh detection uses best-effort browser events and a beacon; the heartbeat is a fallback, not proof of misconduct. At the end of an exam, a missed quit report may not result in a lock. Schools should combine this system with appropriate supervision and accessible accommodations.
- The server deadline is authoritative. Answers can be submitted for a 30-second grace period after it; after that, saved answers are graded. Expired/abandoned attempts are checked on subsequent relevant requests (including the integrity/results pages); there is no background scheduler. A disconnected attempt may instead lock for review. The UI reports an unconfirmed submission and allows a retry instead of claiming success.
- Results remain hidden until a teacher publishes them. Publishing exposes the question-by-question answer key, so do not publish while other students are still taking that paper.
- Cookies are HttpOnly and sessions are revocable; state-changing API requests require a matching Origin. Login and registration are rate-limited. Maintain a trusted reverse proxy and regularly update dependencies and secrets. Browser-side protections are not a substitute for independent security review.

## Local development and verification

For disposable, single-process development only, set `MTC_ALLOW_LOCAL_DEV=true` and a strong `JWT_SECRET` in `.env.local`, leave the Supabase variables blank, and run `npm run create-admin` as above followed by `npm run dev`. The empty local JSON database is created under gitignored `data/`. It is **not** suitable for production, multiple processes, or durable concurrent writes. Import your own private test questions; the bundled legacy seed is public and unsuitable for secure exams. No demo credentials are bundled.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

The automated suite exercises authentication and registration without codes, question pagination, result gating and ownership, browser UI interruption/submit handling, and PostgreSQL functions and legacy migration using PGlite. PGlite and local UI simulations do not replace testing against a real Supabase/PostgREST deployment, multiple database connections, or the specific browsers and devices the school will use. Test these and rehearse restoration before a real examination.

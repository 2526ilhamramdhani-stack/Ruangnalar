# RuangNalar — Vercel deployment package

This package deploys the current interactive **front-end prototype** of RuangNalar.
It contains the responsive learning dashboard, sample lesson, example quiz, timer demo, and local PDF selection UI in Admin AI Studio.

## Deploy to Vercel (recommended path)

1. Extract this ZIP on your computer.
2. Sign in to GitHub and create a new empty repository called `ruangnalar`.
3. Upload the files from this folder (`index.html`, `package.json`, `build.js`, `vercel.json`, and this README) to the repository root, then commit them.
4. Sign in to Vercel and choose **Add New → Project**.
5. Import the `ruangnalar` GitHub repository.
6. Vercel should read `vercel.json`. Check that the Build Command is `npm run build` and Output Directory is `dist`.
7. Select **Deploy**. When deployment succeeds, Vercel shows the public URL ending in `.vercel.app`.
8. Open that URL on laptop and phone to test it.

After the first deployment, pushing new commits to the connected GitHub repository triggers a new deployment automatically.

## Local build check

Requires Node.js 20 or newer:

```bash
npm install
npm run build
```

The generated static website is placed in `dist/index.html`.

## Important limitations of this public demo

- This is a front-end prototype only. There is no real login, authorization, database, persisted student progress, or live AI API connection.
- The Admin AI Studio can select/drop PDF files in the browser and show their names, but the PDF contents are **not uploaded, extracted, or sent to AI**. Do not treat this preview as a functioning content-ingestion system.
- The Admin AI Studio is visible to every visitor. It has no authentication and must not be used with private/ confidential learning documents.
- The sample quiz and exam timer are client-side demos. Scores are not persisted and must not be used for real assessments.
- Before accepting real users, add Supabase authentication, server-side role checks, private object storage, secured AI API calls, database policies (RLS), answer-key protection, input/file validation, rate limits, and appropriate monitoring.

## Security

Never put OpenAI/Gemini keys, Supabase service-role keys, or any other secret in `index.html` or `NEXT_PUBLIC_*` browser variables. Secrets must stay on the server.

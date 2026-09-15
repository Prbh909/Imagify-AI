# Imagify — Final AI Image Intelligence Project

This is the final full-stack version of Imagify.

## What it includes

- Image upload / phone camera capture
- AI visual analysis
- Structured column-style result cards
- Food-specific nutrition and safety fields
- Confidence and uncertainty handling
- Deep Analysis section
- Live camera sampling
- Scan history stored locally in the browser
- Futuristic but student-project-appropriate UI
- No exposed API key in frontend code

## Important architecture

A GitHub repository can store the frontend, but a private AI API key must NOT be placed in `index.html`.

The included `/api/analyze.js` is a Vercel-style serverless endpoint. Deploy the repository to a platform that supports serverless functions, then add:

`OPENAI_API_KEY=your_private_key`

Optional:

`IMAGIFY_MODEL=gpt-5.6-luna`

The frontend calls `/api/analyze`, so the private key stays server-side.

## Local setup

1. Install Node.js.
2. Run:

```bash
npm install
```

3. Set `OPENAI_API_KEY` as an environment variable.
4. Deploy the project with a serverless platform that supports the `/api` directory.
5. Open the deployed site.

Do not commit `.env`, API keys, or secrets to GitHub.

## Live camera

Live Scan samples the camera periodically and sends selected frames for analysis. It is intentionally sampled rather than sending every video frame, which reduces unnecessary requests and makes the school-project demo practical.

## Accuracy note

No image model can guarantee perfect identification of every object or hidden property. Imagify therefore reports uncertainty and only states information supported by the image/model. Food nutrition is approximate and depends on serving size and preparation.

# AI Voice Assistant

This is a browser-based voice assistant using Gemini for LLM responses and Murf AI for text to speech.

## What it does

- Accepts spoken input with the browser Speech Recognition API
- Generates an AI reply with Gemini
- Sends that response to Murf AI for voice generation
- Plays the returned audio in the browser

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from `.env.example` and add your Murf API key and Gemini API key.

3. Start the app:

   ```bash
   npm start
   ```

4. Open `http://localhost:3000`

## Deploy on Render

1. Push this project to GitHub.
2. In Render, create a new Blueprint service from your GitHub repo.
3. Render will detect [render.yaml](C:\Users\VISHNUVARDHAN\OneDrive\Desktop\ai_voice_project\render.yaml).
4. In Render, add secret values for `MURF_API_KEY` and `GEMINI_API_KEY`.
5. Deploy and open the generated `onrender.com` URL on any device.

## Recommended keys

- `GEMINI_API_KEY`: Gemini API key for the chatbot brain
- `MURF_API_KEY`: Murf API key for voice output

## Notes

- If `GEMINI_API_KEY` is missing or Gemini fails, the app falls back to a simple rules-based response.
- Browser speech recognition works best in Chrome or Edge.

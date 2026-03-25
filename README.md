# Murf AI Space Voice Assistant

A futuristic browser-based voice assistant built with React, Tailwind CDN, OpenRouter, and Murf AI. The app supports typed chat, voice input, voice output, saved discussions, a collapsible ChatGPT-style discussion sidebar, and OpenRouter-powered conversation continuity.

## Demo Video

- Demo URL: `https://drive.google.com/file/d/16DGyqliCQ9XmdcjFiR45BLLiUj_v6dqo/view?usp=drivesdk`
- Backup URL: `https://drive.google.com/file/d/1dETZh0e2bk2q4kw9P0Nfkt8Qvp75HPOt/view?usp=drivesdk`

## Features

- Futuristic sci-fi UI with glassmorphism, neon mic controls, and dark gradient visuals
- ChatGPT-style saved discussion history with create, switch, collapse, and delete actions
- Browser speech recognition for voice input
- OpenRouter integration for contextual AI responses
- Murf AI integration for text-to-speech playback
- Local discussion persistence using `localStorage`
- Backend fallback response logic if OpenRouter is unavailable

## Tech Stack

- Frontend: HTML, React, Tailwind CDN, custom CSS
- Backend: Node.js, Express
- LLM: OpenRouter API
- Voice Output: Murf AI
- Voice Input: Browser Speech Recognition API
- Deployment: Render

## How It Works

1. The user types a prompt or speaks through the browser mic.
2. The frontend stores the active discussion locally and sends the current message plus recent discussion history to the backend.
3. The backend sends the conversation context to OpenRouter.
4. OpenRouter returns a text response.
5. The backend sends that text to Murf AI for speech generation.
6. The frontend plays the returned audio and appends the assistant response to the discussion thread.

## Workflow

### Discussion Workflow

- Every discussion is saved in the browser using `localStorage`
- The sidebar shows previous discussions like ChatGPT
- You can create a new discussion, switch discussions, collapse the sidebar, or delete a discussion
- Discussion titles are automatically derived from the first user message

### Chat Workflow

- User sends a typed or spoken message
- Frontend posts to `POST /api/chat`
- Backend forwards the message and prior discussion turns to OpenRouter
- OpenRouter response is returned to the frontend
- Frontend optionally calls `POST /api/voice` to get Murf speech output

### Voice Workflow

- The browser microphone uses Speech Recognition API
- Status changes between `Listening`, `Thinking`, and `Speaking`
- Murf audio is streamed back as a playable URL or base64 payload

## Project Structure

```text
MURFAI_HACKTHON/
|-- public/
|   |-- app.js          # React app UI, discussion state, chat flow, voice controls
|   |-- index.html      # Main HTML shell and CDN imports
|   |-- styles.css      # Custom sci-fi styling and scroll behavior
|-- .env.example        # Example environment variables
|-- package.json        # Project scripts and dependencies
|-- package-lock.json   # Dependency lockfile
|-- README.md           # Project documentation
|-- render.yaml         # Render deployment blueprint
|-- server.js           # Express API, OpenRouter integration, Murf integration
```

## API Endpoints

### `GET /api/health`

Returns app health and configuration state.

### `POST /api/chat`

Request body:

```json
{
  "message": "Tell me about Saturn",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello!" }
  ]
}
```

Response shape:

```json
{
  "reply": "Saturn is the sixth planet from the Sun...",
  "provider": "openrouter"
}
```

### `POST /api/voice`

Request body:

```json
{
  "text": "Saturn is famous for its rings."
}
```

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
MURF_API_KEY=your_murf_api_key_here
MURF_VOICE_ID=en-US-natalie
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openrouter/auto
```

### Variable Reference

- `PORT`: Local server port
- `MURF_API_KEY`: Murf API key for speech generation
- `MURF_VOICE_ID`: Murf voice ID to use for generated speech
- `OPENROUTER_API_KEY`: OpenRouter API key for chat generation
- `OPENROUTER_MODEL`: OpenRouter model name

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`

3. Start the backend:

   ```bash
   npm start
   ```

4. Open the app:

   ```text
   http://localhost:3000
   ```

## Available Scripts

- `npm start`: Start the Express server
- `npm run dev`: Start the server in watch mode

## Deployment

### Render

1. Push the repository to GitHub
2. Create a new Blueprint service in Render
3. Render will detect `render.yaml`
4. Add secret environment variables:
   - `MURF_API_KEY`
   - `OPENROUTER_API_KEY`
5. Deploy the project

## Notes

- Browser speech recognition works best in Chrome or Edge
- The app can still respond with fallback logic if OpenRouter is unavailable
- Discussion history is currently stored in the browser, not in a database
- Tailwind is loaded through CDN for fast prototyping

## Future Improvements

- Store discussions in a database for multi-device sync
- Add user authentication
- Add streaming AI responses
- Add discussion rename support
- Add voice selection in the UI
- Replace Tailwind CDN with a production build pipeline

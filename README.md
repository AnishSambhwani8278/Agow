# Agow

Agow is a macOS desktop application designed to capture your daily updates or thoughts via voice, transcribe the audio using an on-device Whisper model, convert those transcriptions into structured, professional reports using Google's Gemini AI, and finally sync the reports directly to Apple Notes.

## Features

- **Voice Recording & Transcription**: Record your voice and effortlessly transcribe it using an entirely local, on-device Whisper model.
- **AI Structuring**: Connects to the Gemini API to format your raw, unstructured thoughts into a neat, professional daily update.
- **Apple Notes Sync**: Automatically synchronizes your generated updates to an Apple Notes folder named "Daily update" using a seamless AppleScript integration.
- **Dynamic Settings & API Key Management**: Provide your own Gemini API key through an intuitive Settings pane, securely encrypted and managed utilizing your Mac's Keychain.

## Tech Stack

- **Frontend**: React, JavaScript (via Vite)
- **Styling**: Vanilla CSS, leveraging modern and elegant design techniques.
- **Desktop Framework**: Electron for packaging as a native macOS application.
- **AI & Transcription**:
  - `whisper.cpp` packaged as a C++ executable for extremely fast, local audio transcription.
  - Gemini API (via direct fetch / REST) for processing unstructured text to structured output.

## How it Works (Brief Overview)

1. **Initial Setup**: Under Settings (the gear icon on the top right), provide your Gemini API Key. Then, click the download button below the model status to download the offline `ggml-small.bin` Whisper model (needed for taking notes).
2. **Record**: On the main screen, click the "Start Recording" microphone button to begin speaking your daily updates. Click "Stop Recording" when you are finished.
3. **Transcribe**: Behind the scenes, the app executes the local `whisper-cli` binary against your recorded audio file using the downloaded offline model. Your transcribed text will appear in the Raw Input box.
4. **Convert**: Once transcribed, click the "Convert to Note" button. The app communicates with Gemini to structure the transcribed text into a concise, readable daily report.
5. **Sync**: Finally, click "Sync to Notes" to leverage built-in AppleScript capabilities to automatically create or append your note into your local Apple Notes app.

## Development Setup

**Prerequisites**: A native macOS environment is required, as the application inherently depends on Apple Notes and Mac Keychain functionality.

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the application with Vite and Electron concurrently.
4. _(Optional)_ Wait for the `whisper-cli` tool to be built for your machine, or navigate to `whisper.cpp` and `make` it.
5. To package for production, run standard build commands (`npm run build`).


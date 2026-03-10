import { useState, useEffect, useRef } from "react";
import RecordRTC from "recordrtc";
import Settings from "./Settings.jsx";
import "./index.css";

const STATES = {
  EDITING: "EDITING",
  READY_TO_CONVERT: "READY_TO_CONVERT",
  STRUCTURED_VIEW: "STRUCTURED_VIEW",
  SLACK_VIEW: "SLACK_VIEW",
};

const MicIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const StopIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="12" height="12" x="6" y="6" rx="2" ry="2" />
  </svg>
);

const InfoIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

function App() {
  const [appName, setAppName] = useState("");
  const [appTagline, setAppTagline] = useState("");
  const [text, setText] = useState("");
  const [currentState, setCurrentState] = useState(STATES.EDITING);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [settings, setSettings] = useState({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    slackStyle: "Concise, professional, and friendly.",
    updateStyle: "Summary:\nWork Completed:\nBlockers:\nNext Steps:",
    darkMode: true,
    whisperEnabled: false,
  });

  const [structuredNote, setStructuredNote] = useState("");
  const [slackMessage, setSlackMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [audioStatus, setAudioStatus] = useState("idle");
  const recorderRef = useRef(null);

  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = words.length;

  useEffect(() => {
    // Load local storage settings
    window.ipcRenderer
      .invoke("store:get", "settings")
      .then((storedSettings) => {
        if (storedSettings) {
          setSettings((prev) => ({ ...prev, ...storedSettings }));
          if (storedSettings.darkMode !== undefined) {
            document.documentElement.setAttribute(
              "data-theme",
              storedSettings.darkMode ? "dark" : "light",
            );
          }
        }
      });

    // Load app config (name/tagline)
    window.ipcRenderer.invoke("config:get").then((configInfo) => {
      if (configInfo) {
        if (configInfo.appName) setAppName(configInfo.appName);
        if (configInfo.appTagline) setAppTagline(configInfo.appTagline);
      }
    });
  }, []);

  const updateSettings = (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    if (newSettings.darkMode !== undefined) {
      document.documentElement.setAttribute(
        "data-theme",
        newSettings.darkMode ? "dark" : "light",
      );
    }
  };

  const toggleMic = async () => {
    if (audioStatus === "idle") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        recorderRef.current = new RecordRTC(stream, {
          type: "audio",
          mimeType: "audio/wav",
          recorderType: RecordRTC.StereoAudioRecorder,
          desiredSampRate: 16000,
          numberOfAudioChannels: 1,
        });
        recorderRef.current.startRecording();
        setAudioStatus("listening");
        setErrorMsg("");
      } catch (err) {
        console.error("Mic access error:", err);
        setErrorMsg("Could not access microphone.");
      }
    } else if (audioStatus === "listening") {
      setAudioStatus("transcribing");
      if (recorderRef.current) {
        recorderRef.current.stopRecording(async () => {
          const blob = recorderRef.current.getBlob();
          const arrayBuffer = await blob.arrayBuffer();

          // Release microphone tracks
          const tracks = recorderRef.current.stream?.getTracks() || [];
          tracks.forEach((track) => track.stop());
          recorderRef.current.destroy();
          recorderRef.current = null;

          const res = await window.ipcRenderer.invoke(
            "whisper:transcribeFile",
            arrayBuffer,
          );

          if (res && res.success && res.text) {
            setText((prev) => (prev + " " + res.text).trim());
          } else if (res && !res.success) {
            setErrorMsg(res.error || "Failed to transcribe audio.");
          }
          setAudioStatus("idle");
        });
      } else {
        setAudioStatus("idle");
      }
    }
  };

  // Enforce state machine logic
  useEffect(() => {
    if (wordCount < 10 && currentState !== STATES.EDITING) {
      handleReset();
    } else if (wordCount >= 10 && currentState === STATES.EDITING) {
      setCurrentState(STATES.READY_TO_CONVERT);
    } else if (wordCount < 10 && currentState === STATES.READY_TO_CONVERT) {
      setCurrentState(STATES.EDITING);
    }
  }, [wordCount, currentState]);

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);

    if (
      currentState === STATES.STRUCTURED_VIEW ||
      currentState === STATES.SLACK_VIEW
    ) {
      handleReset(newText);
    }
  };

  const handleReset = (newText = text) => {
    const count = newText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    setCurrentState(count >= 10 ? STATES.READY_TO_CONVERT : STATES.EDITING);
    setStructuredNote("");
    setSlackMessage("");
  };

  const handleConvert = async () => {
    setIsLoading(true);
    setErrorMsg("");
    const prompt = `Create a structured daily update based on this raw transcript:
${text}

The structured update must perfectly use the following format:
${settings.updateStyle}

Respond only with the requested structure.`;

    const res = await window.ipcRenderer.invoke(
      "ai:generate",
      prompt,
      settings.model,
      settings.temperature,
    );
    setIsLoading(false);

    if (res.success) {
      setCurrentState(STATES.STRUCTURED_VIEW);
      setStructuredNote(res.text);
      await fetch("https://api-for-agow.onrender.com/count")
    } else {
      setErrorMsg(`Gemini Error: ${res.error}`);
    }
  };

  const handleConvertToSlack = async () => {
    setIsLoading(true);
    setErrorMsg("");
    const prompt = `Create a short Slack update based on this structured daily report:
${structuredNote}

Tone/style instructions: ${settings.slackStyle}

Keep it concise and Slack-friendly. No unnecessary headers. Just the message.`;

    const res = await window.ipcRenderer.invoke(
      "ai:generate",
      prompt,
      settings.model,
      settings.temperature,
    );
    setIsLoading(false);

    if (res.success) {
      setCurrentState(STATES.SLACK_VIEW);
      setSlackMessage(res.text);
    } else {
      setErrorMsg(`Gemini Error: ${res.error}`);
    }
  };

  const handleCopySlack = () => {
    navigator.clipboard.writeText(slackMessage);
  };

  const handleSyncToNotes = async () => {
    setIsLoading(true);
    setErrorMsg("");
    const res = await window.ipcRenderer.invoke("notes:sync", structuredNote);
    setIsLoading(false);
    if (!res.success) {
      setErrorMsg(res.error);
    } else {
      alert("Successfully synced to Apple Notes!");
    }
  };

  return (
    <div className="app-container">
      <div className="top-bar">
        <div>
          <div className="app-title">{appName}</div>
          {appTagline && (
            <div
              className="app-tagline"
              style={{
                fontSize: "0.85em",
                color: "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              {appTagline}
            </div>
          )}
        </div>
        <div className="top-bar-controls">
          <span className="date-display">
            Today's Date: {new Date().toLocaleDateString()}
          </span>
          <button
            className="icon-btn"
            title="Settings"
            onClick={() => setShowSettings(true)}
            style={{ color: "inherit" }}
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      <main className="main-content">
        {errorMsg && (
          <div
            style={{
              color: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ef4444",
            }}
          >
            {errorMsg}
          </div>
        )}

        <div className="editor-container" style={{ position: "relative" }}>
          {settings.whisperEnabled && (
            <button
              className="icon-btn"
              onClick={toggleMic}
              title={
                audioStatus === "idle"
                  ? "Start typing or use voice"
                  : audioStatus === "listening"
                    ? "Stop listening"
                    : "Transcribing..."
              }
              disabled={audioStatus === "transcribing"}
              style={{
                position: "absolute",
                right: "16px",
                top: "16px",
                zIndex: 10,
                color: audioStatus === "listening" ? "var(--error)" : "inherit",
                opacity: audioStatus === "transcribing" ? 0.5 : 1,
                cursor:
                  audioStatus === "transcribing" ? "not-allowed" : "pointer",
                animation:
                  audioStatus === "listening" ? "pulse 2s infinite" : "none",
              }}
            >
              {audioStatus === "listening" ? <StopIcon /> : <MicIcon />}
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => setShowInfo(true)}
            title="Instructions"
            style={{
              position: "absolute",
              right: "16px",
              top: settings.whisperEnabled ? "60px" : "16px",
              zIndex: 10,
              color: "inherit",
            }}
          >
            <InfoIcon />
          </button>
          <textarea
            className="editor-textarea"
            placeholder={
              audioStatus === "listening"
                ? "Listening..."
                : audioStatus === "transcribing"
                  ? "Transcribing..."
                  : "Start typing or use voice..."
            }
            value={text}
            onChange={handleTextChange}
            disabled={audioStatus === "transcribing"}
            autoFocus
          />
        </div>

        {currentState === STATES.STRUCTURED_VIEW && (
          <div className="output-container">
            <h3>Structured Note</h3>
            <pre className="note-preview">{structuredNote}</pre>
          </div>
        )}

        {currentState === STATES.SLACK_VIEW && (
          <div className="output-container">
            <h3>Slack Update</h3>
            <div className="slack-preview">{slackMessage}</div>
          </div>
        )}

        <div className="actions-bar">
          <div className="status-text">
            Word count: {wordCount}
            {wordCount < 10 && " (Needs 10 to convert)"}
            {currentState === STATES.STRUCTURED_VIEW && " • Structured View"}
            {currentState === STATES.SLACK_VIEW && " • Slack View"}
          </div>

          <div className="action-buttons">
            {currentState === STATES.READY_TO_CONVERT && (
              <button
                className="convert-btn"
                onClick={handleConvert}
                disabled={isLoading}
              >
                {isLoading ? "Generating..." : "Convert"}
              </button>
            )}

            {currentState === STATES.STRUCTURED_VIEW && (
              <>
                <button
                  className="secondary-btn"
                  onClick={handleSyncToNotes}
                  disabled={isLoading}
                >
                  Sync to Notes
                </button>
                <button
                  className="convert-btn"
                  onClick={handleConvertToSlack}
                  disabled={isLoading}
                >
                  {isLoading ? "Generating..." : "Convert to Slack"}
                </button>
              </>
            )}

            {currentState === STATES.SLACK_VIEW && (
              <button className="convert-btn" onClick={handleCopySlack}>
                Copy to Clipboard
              </button>
            )}
          </div>
        </div>
      </main>

      {showInfo && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Instructions</h2>
              <button className="icon-btn" onClick={() => setShowInfo(false)}>
                ✕
              </button>
            </div>
            <div className="settings-body" style={{ padding: "0 20px" }}>
              <p>
                Welcome to <strong>agow</strong>!
              </p>
              <ul
                style={{
                  paddingLeft: "20px",
                  marginTop: "10px",
                  lineHeight: "1.5",
                }}
              >
                <li style={{ marginBottom: "10px" }}>
                  To sync your updates directly to Apple Notes, you must first
                  create a folder named <strong>Daily update</strong> in Apple
                  Notes under <strong>On My Mac</strong>.
                </li>
                <li style={{ marginBottom: "10px" }}>
                  Make sure to grant this application{" "}
                  <strong>Microphone</strong> permissions and{" "}
                  <strong>Accessibility</strong> permissions so it can execute
                  AppleScripts.
                </li>
                <li>
                  Wait for the Whisper model download to finish before recording
                  (Check Settings panel).
                </li>
              </ul>
            </div>
            <div className="modal-footer">
              <button
                className="convert-btn"
                onClick={() => setShowInfo(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onChange={updateSettings}
        />
      )}
    </div>
  );
}

export default App;

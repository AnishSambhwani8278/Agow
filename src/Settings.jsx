import { useState, useEffect } from "react";

export default function Settings({ onClose, onChange }) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [temperature, setTemperature] = useState(0.7);
  const [slackStyle, setSlackStyle] = useState(
    "Concise, professional, and friendly.",
  );
  const [updateStyle, setUpdateStyle] = useState(
    "Summary:\nWork Completed:\nBlockers:\nNext Steps:",
  );
  const [whisperEnabled, setWhisperEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [hasModel, setHasModel] = useState(false);

  useEffect(() => {
    const handleProgress = (event, progress) => {
      setDownloadProgress(progress);
    };
    window.ipcRenderer.on("whisper:downloadProgress", handleProgress);
    return () => {
      window.ipcRenderer.off("whisper:downloadProgress", handleProgress);
    };
  }, []);

  useEffect(() => {
    // Load existing settings
    window.ipcRenderer.invoke("store:get", "settings").then((settings) => {
      if (settings) {
        if (settings.model) setModel(settings.model);
        if (settings.temperature) setTemperature(settings.temperature);
        if (settings.slackStyle) setSlackStyle(settings.slackStyle);
        if (settings.updateStyle) setUpdateStyle(settings.updateStyle);
        if (settings.whisperEnabled !== undefined) {
          setWhisperEnabled(settings.whisperEnabled);
        } else {
          setWhisperEnabled(false);
        }
        if (settings.darkMode !== undefined) setDarkMode(settings.darkMode);
      }
    });

    window.ipcRenderer.invoke("keychain:get").then((key) => {
      if (key) setApiKey(key);
    });

    window.ipcRenderer.invoke("whisper:checkModel").then(setHasModel);
  }, []);

  const handleWhisperToggle = async (e) => {
    const checked = e.target.checked;
    setWhisperEnabled(checked);
    if (checked) {
      const modelExists = await window.ipcRenderer.invoke("whisper:checkModel");
      if (!modelExists) {
        setDownloading(true);
        setDownloadProgress(0);
        const res = await window.ipcRenderer.invoke("whisper:downloadModel");
        setDownloading(false);
        if (!res?.success) {
          alert("Failed to download model: " + (res?.error || "Unknown"));
          setWhisperEnabled(false);
        } else {
          setHasModel(true);
        }
      } else {
        setHasModel(true);
      }
    }
  };

  const handleSave = async () => {
    if (downloading) return;
    const newSettings = {
      model,
      temperature,
      slackStyle,
      updateStyle,
      whisperEnabled,
      darkMode,
    };
    await window.ipcRenderer.invoke("store:set", "settings", newSettings);
    await window.ipcRenderer.invoke("keychain:set", apiKey);

    onChange(newSettings);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body">
          <section>
            <h3>AI / Gemini</h3>
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
            </label>
            <label>
              <span>Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              </select>
            </label>
            <label>
              <span>Temperature: {temperature}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </label>
            <label>
              <span>Slack Style Instructions</span>
              <textarea
                value={slackStyle}
                onChange={(e) => setSlackStyle(e.target.value)}
                placeholder="e.g. Keep it casual and short"
                rows={2}
              />
            </label>
            <label>
              <span>Structured Update Style Instructions</span>
              <textarea
                value={updateStyle}
                onChange={(e) => setUpdateStyle(e.target.value)}
                placeholder="e.g. Summary:\nTasks done:\nBlockers:\nNext steps:"
                rows={4}
              />
            </label>
          </section>

          <section>
            <h3>Whisper.cpp (Local Voice)</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={whisperEnabled}
                onChange={handleWhisperToggle}
                disabled={downloading}
              />
              <span>Enable Whisper</span>
            </label>
            {whisperEnabled && (
              <div
                className="whisper-status"
                style={{
                  marginTop: "10px",
                  fontSize: "0.9em",
                  color: "var(--text-light)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {downloading
                  ? `Downloading Whisper model... ${downloadProgress}%`
                  : "Whisper module is ready."}
                {!downloading && hasModel && (
                  <button
                    className="icon-btn"
                    style={{
                      fontSize: "14px",
                      padding: "2px 6px",
                      color: "#ff4d4d",
                    }}
                    onClick={async () => {
                      const res = await window.ipcRenderer.invoke(
                        "whisper:deleteModel",
                      );
                      if (res.success) {
                        setHasModel(false);
                        setWhisperEnabled(false);
                      } else {
                        alert("Failed to delete model: " + res.error);
                      }
                    }}
                    title="Delete Whisper Model"
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          </section>

          <section>
            <h3>App UI</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
              />
              <span>Dark Mode</span>
            </label>
          </section>
        </div>

        <div className="modal-footer">
          <button
            className="secondary-btn"
            onClick={onClose}
            disabled={downloading}
          >
            Cancel
          </button>
          <button
            className="convert-btn"
            onClick={handleSave}
            disabled={downloading}
          >
            {saved
              ? "Saved!"
              : downloading
                ? "Downloading..."
                : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

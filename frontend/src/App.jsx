import React, { useEffect, useRef, useState } from "react";

const API_URL = (
  import.meta.env.VITE_AGENT_API_URL ||
  (import.meta.env.PROD
    ? "/api"
    : "https://atlanta-heat-advisor-1004921377034.us-central1.run.app")
).replace(/\/+$/, "");
const USER_ID = "frontend-user";
const SUGGESTIONS = [
  "Where should we place three cooling centers?",
  "How often does Atlanta reach 95°F?",
  "Compare heat risk across Atlanta neighborhoods",
];

async function ensureOk(response) {
  if (response.ok) return;

  const detail = await response.text();
  throw new Error(
    detail
      ? `Agent request failed (${response.status}): ${detail}`
      : `Agent request failed with status ${response.status}.`,
  );
}

function getAssistantText(events) {
  if (!Array.isArray(events)) {
    throw new Error("The agent returned an unexpected response.");
  }

  const text = events
    .filter((event) => event.author !== "user")
    .flatMap((event) => event.content?.parts ?? [])
    .map((part) => part.text)
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("The agent did not return a text response.");
  }

  return text;
}

async function readJson(response) {
  await ensureOk(response);
  try {
    return await response.json();
  } catch {
    throw new Error("The agent returned an invalid response.");
  }
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [sessionReady, setSessionReady] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, error]);

  async function sendMessage(text) {
    const query = text.trim();
    if (!query || pending) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: query },
    ]);
    setDraft("");
    setError("");
    setPending(true);

    try {
      if (!sessionReady) {
        await readJson(
          await fetch(
            `${API_URL}/apps/agent/users/${USER_ID}/sessions/${sessionId}`,
            { method: "POST" },
          ),
        );
        setSessionReady(true);
      }

      const events = await readJson(
        await fetch(`${API_URL}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_name: "agent",
            user_id: USER_ID,
            session_id: sessionId,
            new_message: {
              role: "user",
              parts: [{ text: query }],
            },
          }),
        }),
      );

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: getAssistantText(events) },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to contact the heat advisor.",
      );
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    void sendMessage(draft);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Atlanta Heat Advisor home">
          <span className="brand-mark" aria-hidden="true">
            H
          </span>
          <span>Heatwise</span>
        </a>
        <div className="location-tag">
          <span className="location-dot" />
          Atlanta, Georgia
        </div>
      </header>

      <section className="workspace" aria-label="Heat resilience assistant">
        <div className="intro">
          <p className="eyebrow">CITY HEAT RESILIENCE</p>
          <h1>Plan for a cooler, safer Atlanta.</h1>
          <p className="intro-copy">
            Ask about neighborhood heat risk, cooling center locations, and
            climate resilience planning.
          </p>
        </div>

        {messages.length === 0 ? (
          <div className="suggestions" aria-label="Suggested questions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                className="suggestion"
                key={suggestion}
                onClick={() => void sendMessage(suggestion)}
                type="button"
              >
                <span>{suggestion}</span>
                <span className="suggestion-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="conversation" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`message message-${message.role}`}
                key={message.id}
              >
                {message.role === "assistant" && (
                  <span className="message-label">HEATWISE ADVISOR</span>
                )}
                <p>{message.text}</p>
              </article>
            ))}
            {pending && (
              <div className="thinking" role="status">
                <span className="thinking-dot" />
                Reviewing Atlanta heat data…
              </div>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <form className="composer" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="question">
            Ask about Atlanta heat resilience
          </label>
          <textarea
            id="question"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            placeholder="Ask a question about Atlanta heat resilience…"
            rows={2}
            value={draft}
          />
          <div className="composer-footer">
            <span>Atlanta-focused planning guidance</span>
            <button
              aria-label="Send question"
              className="send-button"
              disabled={!draft.trim() || pending}
              type="submit"
            >
              {pending ? "…" : "↑"}
            </button>
          </div>
        </form>

        <p className="disclaimer">
          Planning support for city teams. Verify recommendations before acting.
        </p>
      </section>
    </main>
  );
}

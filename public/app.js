const { createElement: h, useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEY = "murf-futuristic-discussions-v1";
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;
const API_BASE =
  window.location.port === "3000" || window.location.port === ""
    ? ""
    : "http://localhost:3000";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAssistantMessage(content) {
  return {
    id: createId(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString()
  };
}

function createUserMessage(content) {
  return {
    id: createId(),
    role: "user",
    content,
    createdAt: new Date().toISOString()
  };
}

function createDiscussion() {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "New discussion",
    createdAt: now,
    updatedAt: now,
    messages: [
      createAssistantMessage(
        "Neural channel online. Ask me anything and I will keep this discussion saved like ChatGPT."
      )
    ]
  };
}

function getStoredDiscussions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [createDiscussion()];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return [createDiscussion()];
    }

    return parsed;
  } catch (_error) {
    return [createDiscussion()];
  }
}

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch (_error) {
    return "";
  }
}

function formatDiscussionStamp(value) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch (_error) {
    return "";
  }
}

function deriveDiscussionTitle(messages) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) {
    return "New discussion";
  }

  return firstUserMessage.content.trim().slice(0, 36) || "New discussion";
}

function App() {
  const initialDiscussionsRef = useRef(null);
  if (!initialDiscussionsRef.current) {
    initialDiscussionsRef.current = getStoredDiscussions();
  }

  const [discussions, setDiscussions] = useState(initialDiscussionsRef.current);
  const [activeDiscussionId, setActiveDiscussionId] = useState(
    initialDiscussionsRef.current[0].id
  );
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Idle");
  const [healthText, setHealthText] = useState("Syncing assistant core...");
  const [voiceInfo, setVoiceInfo] = useState("Preparing voice engine");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [speechSupported] = useState(Boolean(SpeechRecognition));
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const activeDiscussion = useMemo(() => {
    return (
      discussions.find((discussion) => discussion.id === activeDiscussionId)
      || discussions[0]
    );
  }, [activeDiscussionId, discussions]);

  const activeMessageCount = activeDiscussion?.messages?.length || 0;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(discussions));
  }, [discussions]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
  }, [activeDiscussionId, activeMessageCount, status]);

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        const murfStatus = data.murfConfigured ? "Murf ready" : "Murf key missing";
        const llmStatus = data.openRouterConfigured
          ? "OpenRouter ready"
          : "OpenRouter fallback";

        setHealthText(`${murfStatus} | ${llmStatus}`);
        setVoiceInfo(`Voice ${data.voiceId} | Brain ${data.llmModel}`);
      } catch (error) {
        setHealthText("Server offline");
        setVoiceInfo(error.message || "Unable to reach API");
      }
    }

    loadHealth();
  }, []);

  useEffect(() => {
    if (!SpeechRecognition) {
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Listening");
      setAudioError("");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      setDraft(transcript);

      const finalResult = event.results[event.results.length - 1];
      if (finalResult?.isFinal && transcript) {
        submitMessage(transcript);
      }
    };

    recognition.onerror = (event) => {
      setAudioError(`Mic error: ${event.error}`);
      setStatus("Idle");
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatus((currentStatus) => (currentStatus === "Listening" ? "Idle" : currentStatus));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [activeDiscussionId]);

  function upsertDiscussion(updatedDiscussion) {
    setDiscussions((currentDiscussions) =>
      currentDiscussions
        .map((discussion) =>
          discussion.id === updatedDiscussion.id ? updatedDiscussion : discussion
        )
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
    );
  }

  function appendMessage(discussionId, message) {
    setDiscussions((currentDiscussions) =>
      currentDiscussions
        .map((discussion) => {
          if (discussion.id !== discussionId) {
            return discussion;
          }

          const nextMessages = discussion.messages.concat(message);
          return {
            ...discussion,
            messages: nextMessages,
            title: deriveDiscussionTitle(nextMessages),
            updatedAt: new Date().toISOString()
          };
        })
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
    );
  }

  async function playReply(text) {
    try {
      setStatus("Speaking");
      const response = await fetch(`${API_BASE}/api/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Voice synthesis failed.");
      }

      const audioSource =
        data.audioUrl
        || (data.encodedAudio ? `data:audio/mp3;base64,${data.encodedAudio}` : "");

      if (!audioSource) {
        throw new Error("No playable audio returned.");
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioSource);
      audioRef.current = audio;

      audio.onended = () => {
        setStatus("Idle");
      };

      audio.onerror = () => {
        setStatus("Idle");
        setAudioError("Audio playback failed.");
      };

      await audio.play();
    } catch (error) {
      setStatus("Idle");
      setAudioError(error.message);
    }
  }

  async function submitMessage(explicitMessage) {
    const messageText = (explicitMessage || draft).trim();
    if (!messageText || !activeDiscussion) {
      return;
    }

    setDraft("");
    setIsSending(true);
    setStatus("Thinking");
    setAudioError("");

    const userMessage = createUserMessage(messageText);
    const currentDiscussionId = activeDiscussion.id;
    const historyForApi = activeDiscussion.messages.map((message) => ({
      role: message.role,
      content: message.content
    }));

    appendMessage(currentDiscussionId, userMessage);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history: historyForApi
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate a response.");
      }

      const replyText = data.warning ? `${data.reply}\n\n${data.warning}` : data.reply;
      const assistantMessage = createAssistantMessage(replyText);
      appendMessage(currentDiscussionId, assistantMessage);
      await playReply(data.reply);
    } catch (error) {
      appendMessage(
        currentDiscussionId,
        createAssistantMessage(`System note: ${error.message}`)
      );
      setStatus("Idle");
      setAudioError(error.message);
    } finally {
      setIsSending(false);
    }
  }

  function handleStartDiscussion() {
    const discussion = createDiscussion();
    setDiscussions((currentDiscussions) => [discussion].concat(currentDiscussions));
    setActiveDiscussionId(discussion.id);
    setDraft("");
    setStatus("Idle");
    setAudioError("");
  }

  function handleDeleteDiscussion(discussionId) {
    setDiscussions((currentDiscussions) => {
      const filteredDiscussions = currentDiscussions.filter(
        (discussion) => discussion.id !== discussionId
      );

      if (!filteredDiscussions.length) {
        const replacementDiscussion = createDiscussion();
        setActiveDiscussionId(replacementDiscussion.id);
        return [replacementDiscussion];
      }

      if (discussionId === activeDiscussionId) {
        setActiveDiscussionId(filteredDiscussions[0].id);
      }

      return filteredDiscussions;
    });
  }

  function handleToggleListening() {
    if (!recognitionRef.current) {
      setAudioError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    recognitionRef.current.start();
  }

  function handleStopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus("Idle");
  }

  function renderSidebarDiscussion(discussion) {
    const isActive = discussion.id === activeDiscussionId;
    const preview = discussion.messages[discussion.messages.length - 1]?.content || "";

    return h(
      "div",
      {
        key: discussion.id,
        className:
          "discussion-row group w-full rounded-2xl px-3 py-3 transition duration-200 " +
          (isActive
            ? "bg-white/12 text-white"
            : "bg-transparent text-slate-300 hover:bg-white/8")
      },
      h(
        "div",
        { className: "flex items-start gap-2" },
        h(
          "button",
          {
            type: "button",
            onClick: () => setActiveDiscussionId(discussion.id),
            className: "min-w-0 flex-1 text-left"
          },
          h(
            "p",
            {
              className:
                "truncate text-[14px] font-medium leading-6 " +
                (isActive ? "text-white" : "text-slate-200")
            },
            discussion.title
          ),
          h(
            "p",
            {
              className:
                "mt-1 truncate text-xs leading-5 " +
                (isActive ? "text-slate-300" : "text-slate-500")
            },
            preview
          )
        ),
        h(
          "button",
          {
            type: "button",
            onClick: () => handleDeleteDiscussion(discussion.id),
            className:
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-rose-200 group-hover:opacity-100 focus:opacity-100",
            title: "Delete discussion"
          },
          h(
            "svg",
            {
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.8",
              className: "h-4 w-4"
            },
            h("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              d: "M6 7h12M9 7V5h6v2m-7 4v6m4-6v6m4-6v6M8 19h8a1 1 0 0 0 1-1V7H7v11a1 1 0 0 0 1 1Z"
            })
          )
        )
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => setActiveDiscussionId(discussion.id),
          className: "mt-2 block text-left"
        },
        h(
          "p",
          {
            className:
              "text-[10px] uppercase tracking-[0.22em] " +
              (isActive ? "text-slate-400" : "text-slate-600")
          },
          formatDiscussionStamp(discussion.updatedAt)
        )
      )
    );
  }

  function renderMessage(message) {
    const isAssistant = message.role === "assistant";

    return h(
      "div",
      {
        key: message.id,
        className:
          "animate-fade-rise flex " + (isAssistant ? "justify-start" : "justify-end")
      },
      h(
        "div",
        {
          className:
            "max-w-[85%] rounded-[28px] border px-5 py-4 shadow-2xl backdrop-blur-xl " +
            (isAssistant
              ? "border-cyan-300/20 bg-white/10 text-slate-100"
              : "border-fuchsia-300/30 bg-gradient-to-br from-cyan-400/20 via-sky-400/15 to-fuchsia-500/20 text-cyan-50")
        },
        h(
          "div",
          { className: "mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.24em]" },
          h(
            "span",
            {
              className:
                "inline-flex h-2.5 w-2.5 rounded-full " +
                (isAssistant ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" : "bg-fuchsia-300 shadow-[0_0_12px_rgba(240,171,252,0.9)]")
            }
          ),
          isAssistant ? "Assistant" : "You",
          h("span", { className: "text-slate-500" }, formatTime(message.createdAt))
        ),
        h(
          "p",
          { className: "whitespace-pre-wrap text-sm leading-7 text-slate-100" },
          message.content
        )
      )
    );
  }

  const statusTone =
    status === "Listening"
      ? "from-cyan-400/80 to-blue-500/80"
      : status === "Thinking"
        ? "from-amber-300/80 to-orange-500/80"
        : status === "Speaking"
          ? "from-fuchsia-400/80 to-violet-500/80"
          : "from-emerald-300/60 to-cyan-400/60";

  return h(
    "div",
    { className: "relative min-h-screen overflow-x-hidden text-slate-100" },
    h("div", { className: "cosmic-grid absolute inset-0 opacity-40" }),
    h("div", { className: "nebula nebula-one" }),
    h("div", { className: "nebula nebula-two" }),
    h(
      "div",
      { className: "relative z-10 flex min-h-screen flex-col lg:flex-row" },
      h(
        "aside",
        {
          className:
            "glass-panel overflow-hidden border-b border-white/10 px-3 py-5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex lg:h-screen lg:flex-col lg:self-start lg:border-b-0 lg:border-r " +
            (isSidebarCollapsed ? "lg:w-[88px]" : "lg:w-[340px]")
        },
        isSidebarCollapsed
          ? h(
              "div",
              { className: "animate-fade-rise flex h-full flex-col items-center gap-4 lg:min-h-0" },
              h(
                "button",
                {
                  type: "button",
                  onClick: () => setIsSidebarCollapsed(false),
                  className:
                    "inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10",
                  title: "Expand discussions"
                },
                h(
                  "svg",
                  {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "1.8",
                    className: "h-5 w-5"
                  },
                  h("path", {
                    strokeLinecap: "round",
                    d: "M4 7h16M4 12h16M4 17h16"
                  })
                )
              ),
              h(
                "button",
                {
                  type: "button",
                  onClick: handleStartDiscussion,
                  className:
                    "inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 transition hover:bg-cyan-300/20",
                  title: "New discussion"
                },
                "+"
              )
            )
          : [
              h(
                "div",
                {
                  key: "sidebar-header",
                  className: "animate-fade-rise flex items-center justify-between gap-3 px-2"
                },
                h(
                  "div",
                  null,
                  h(
                    "p",
                    { className: "text-[11px] uppercase tracking-[0.35em] text-cyan-300/80" },
                    "Neural Archive"
                  ),
                  h("h1", { className: "mt-2 text-2xl font-semibold text-white" }, "Discussions")
                ),
                h(
                  "div",
                  { className: "flex items-center gap-2" },
                  h(
                    "button",
                    {
                      type: "button",
                      onClick: handleStartDiscussion,
                      className:
                        "rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/20"
                    },
                    "New discussion"
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      onClick: () => setIsSidebarCollapsed(true),
                      className:
                        "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10",
                      title: "Collapse discussions"
                    },
                    h(
                      "svg",
                      {
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "1.8",
                        className: "h-5 w-5"
                      },
                      h("path", {
                        strokeLinecap: "round",
                        d: "M4 7h16M4 12h16M4 17h16"
                      })
                    )
                  )
                )
              ),
              h(
                "p",
                {
                  key: "sidebar-copy",
                  className: "animate-fade-rise mt-4 px-2 text-sm leading-6 text-slate-400"
                },
                "Every chat stays saved locally so you can reopen the thread and keep the same conversation flow."
              ),
              h(
                "div",
                {
                  key: "sidebar-list",
                  className:
                    "custom-scroll animate-fade-rise mt-6 space-y-3 overflow-y-auto px-2 lg:min-h-0 lg:flex-1"
                },
                discussions.map(renderSidebarDiscussion)
              )
            ]
      ),
      h(
        "main",
        { className: "flex min-h-screen min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8" },
        h(
          "section",
          {
            className:
              "glass-panel relative overflow-hidden rounded-[32px] border border-white/10 px-6 py-6 shadow-2xl"
          },
          h("div", { className: "hero-aurora pointer-events-none absolute inset-0" }),
          h(
            "div",
            { className: "relative z-10 flex flex-col gap-6" },
            h(
              "div",
              { className: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between" },
              h(
                "div",
                { className: "max-w-2xl" },
                h(
                  "p",
                  { className: "text-[11px] uppercase tracking-[0.35em] text-cyan-300/80" },
                  "Sci-Fi Voice Core"
                ),
                h(
                  "h2",
                  { className: "mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl" },
                  "Ask anything about space?"
                ),
                h(
                  "p",
                  { className: "mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base" },
                  "Dive into mysteries like black holes, distant galaxies, and the origins of the universe with explanations that are both simple and deeply insightful."
                )
              ),
              h(
                "div",
                { className: "grid gap-3 sm:grid-cols-2 lg:w-[360px]" },
                h(
                  "div",
                  { className: "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl" },
                  h("p", { className: "text-[11px] uppercase tracking-[0.28em] text-slate-400" }, "System"),
                  h("p", { className: "mt-2 text-sm font-medium text-white" }, healthText)
                ),
                h(
                  "div",
                  { className: "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl" },
                  h("p", { className: "text-[11px] uppercase tracking-[0.28em] text-slate-400" }, "Voice Stack"),
                  h("p", { className: "mt-2 text-sm font-medium text-white" }, voiceInfo)
                )
              )
            ),
            h(
              "div",
              { className: "relative mx-auto flex w-full max-w-4xl justify-center py-4" },
              h("div", { className: "absolute inset-0 mx-auto h-full w-full max-w-xl rounded-full bg-cyan-400/5 blur-3xl" }),
              h(
                "button",
                {
                  type: "button",
                  onClick: handleToggleListening,
                  className:
                    "relative z-10 flex h-32 w-32 items-center justify-center rounded-full border border-cyan-200/30 bg-white/10 shadow-neon backdrop-blur-2xl transition duration-300 hover:scale-105 " +
                    (status === "Listening" ? "animate-soft-pulse" : "")
                },
                h("span", { className: "absolute inset-0 rounded-full border border-cyan-300/30" }),
                h("span", { className: "absolute inset-3 rounded-full bg-gradient-to-br from-cyan-300/20 via-white/10 to-fuchsia-400/20" }),
                h(
                  "span",
                  {
                    className:
                      "relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br " +
                      statusTone
                  },
                  h(
                    "svg",
                    {
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: "1.8",
                      className: "h-9 w-9 text-slate-950"
                    },
                    h("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      d: "M12 4a3 3 0 0 0-3 3v5a3 3 0 1 0 6 0V7a3 3 0 0 0-3-3Zm6 8a6 6 0 0 1-12 0M12 18v2m-4 0h8"
                    })
                  )
                )
              )
            ),
            h(
              "div",
              { className: "flex flex-wrap items-center justify-center gap-3" },
              h(
                "span",
                {
                  className:
                    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-200"
                },
                h(
                  "span",
                  {
                    className:
                      "inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r " + statusTone
                  }
                ),
                status
              ),
              h(
                "span",
                {
                  className:
                    "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-400"
                },
                speechSupported ? "Voice input ready" : "Voice input unavailable"
              ),
              h(
                "button",
                {
                  type: "button",
                  onClick: handleStopAudio,
                  className:
                    "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300 transition hover:bg-white/10"
                },
                "Stop audio"
              )
            ),
            audioError
              ? h(
                  "p",
                  {
                    className:
                      "mx-auto max-w-2xl rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-100"
                  },
                  audioError
                )
              : null
          )
        ),
        h(
          "section",
          {
            className:
              "glass-panel mt-4 flex min-h-[420px] min-h-0 flex-1 flex-col rounded-[32px] border border-white/10 px-4 py-4 shadow-2xl sm:px-5"
          },
          h(
            "div",
            {
              ref: messagesContainerRef,
              className: "custom-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2 sm:px-2"
            },
            activeDiscussion.messages.map(renderMessage),
            isSending
              ? h(
                  "div",
                  { className: "flex justify-start" },
                  h(
                    "div",
                    {
                      className:
                        "rounded-[28px] border border-cyan-300/20 bg-white/10 px-5 py-4 text-sm text-slate-200 backdrop-blur-xl"
                    },
                    "Thinking through the next reply..."
                  )
                )
              : null,
            h("div", { ref: messagesEndRef })
          ),
          h(
            "div",
            { className: "mt-4 rounded-[28px] border border-white/10 bg-white/5 p-3 backdrop-blur-xl" },
            h(
              "div",
              { className: "flex flex-col gap-3 sm:flex-row" },
              h("textarea", {
                value: draft,
                onChange: (event) => setDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                },
                rows: 3,
                placeholder: "Type a message or tap the mic to speak...",
                className:
                  "min-h-[92px] flex-1 resize-none rounded-[22px] border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:bg-slate-950/60"
              }),
              h(
                "div",
                { className: "flex gap-3 sm:w-[200px] sm:flex-col" },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => submitMessage(),
                    disabled: isSending,
                    className:
                      "flex-1 rounded-[22px] bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                  },
                  isSending ? "Sending..." : "Send"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleToggleListening,
                    className:
                      "flex-1 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  },
                  isListening ? "Stop mic" : "Start mic"
                )
              )
            )
          )
        )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));

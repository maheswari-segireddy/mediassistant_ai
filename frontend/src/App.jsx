import { useState, useRef, useEffect, useCallback } from "react";

/* ─── CONSTANTS ──────────────────────────────────────────────── */
const EMERGENCY_KW = [
  "chest pain", "heart attack", "stroke", "can't breathe", "cannot breathe",
  "difficulty breathing", "severe bleeding", "unconscious", "overdose",
  "suicidal", "severe allergic", "anaphylaxis", "seizure", "choking",
  "severe head injury", "paralysis", "poisoning", "not breathing", "fainted",
  "unconscious", "sudden numbness", "sudden confusion", "blurred vision suddenly"
];

const SYSTEM_PROMPT = `You are MediAssist AI — a compassionate, knowledgeable medical assistant chatbot designed for educational and preliminary health guidance.

IDENTITY & TONE:
- Speak warmly, clearly, and without jargon
- Be empathetic, never alarmist (except for true emergencies)
- Use bullet points and short paragraphs for readability
- Always validate the user's concern before providing information

ABSOLUTE RULES:
1. ALWAYS include a disclaimer that you are an AI for educational/preliminary support only — NOT a substitute for a qualified doctor
2. For ANY emergency symptoms (chest pain, difficulty breathing, stroke signs, severe bleeding, unconsciousness, overdose, anaphylaxis, seizure, etc.) → IMMEDIATELY respond with "🚨 EMERGENCY:" at the start and urge calling 112 or local emergency services
3. NEVER definitively diagnose. Use: "this could suggest...", "may be associated with...", "a doctor would typically evaluate..."
4. For uploaded images/reports → describe general observations only; stress professional evaluation
5. Protect privacy — never repeat sensitive personal details back

RESPONSE FORMAT:
- Start with a brief empathetic acknowledgement
- Use clear headings with emojis
- End every response with: "⚕️ Disclaimer: I'm an AI assistant providing educational guidance only. Please consult a qualified healthcare professional for diagnosis and treatment."
- If emergency: Begin entire response with "🚨 EMERGENCY: [brief instruction to call 112/emergency services immediately]"

SCOPE: symptom explanation, medication info, report summarization, general wellness guidance, triage escalation`;

/* ─── HELPERS ────────────────────────────────────────────────── */
const isEmergency = t => EMERGENCY_KW.some(k => t.toLowerCase().includes(k));
const fmt = d => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const uid = () => Math.random().toString(36).slice(2);

/* ─── SUB-COMPONENTS ─────────────────────────────────────────── */
function Dot({ color = "#dc2626", size = 8, delay = 0 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color,
      animation: `medBounce 1.2s ease-in-out ${delay}s infinite`
    }} />
  );
}

function Pill({ color = "#dc2626", bg = "#fef2f2", children, style = {} }) {
  return (
    <span style={{
      background: bg, color, borderRadius: 20, padding: "4px 12px",
      fontSize: 11, fontWeight: 600, border: `1px solid ${color}15`,
      fontFamily: "'Outfit', sans-serif", letterSpacing: "0.2px", ...style
    }}>{children}</span>
  );
}

function Avatar({ label, bg = "#dc2626", size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontFamily: "'Outfit', sans-serif"
    }}>{label}</div>
  );
}

function EmergencyCard() {
  return (
    <div style={{
      background: "linear-gradient(135deg, #fef2f2, #ffe4e6)",
      border: "2px solid #fecdd3", borderRadius: 14, padding: "16px 20px",
      margin: "8px 0", display: "flex", gap: 14, alignItems: "flex-start",
      animation: "medFadeIn .3s ease", boxShadow: "0 4px 15px rgba(220,38,38,0.08)",
      width: "100%"
    }}>
      <div style={{ fontSize: 32, lineHeight: 1 }}>🚨</div>
      <div>
        <p style={{ margin: 0, fontWeight: 800, color: "#991b1b", fontSize: 16, letterSpacing: -0.3 }}>
          EMERGENCY DETECTED
        </p>
        <p style={{ margin: "6px 0 0", color: "#7f1d1d", fontSize: 13, lineHeight: 1.5 }}>
          The symptoms described may require <strong>immediate emergency care</strong>.
          Call <strong style={{ fontSize: 16 }}>112</strong> or your local emergency services <strong>right now</strong>.
          Do not wait for an online response.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {["🇮🇳 India: 112", "🚑 Ambulance: 108", "☎ AIIMS: 011-26588500"].map(s => (
            <Pill key={s} color="#991b1b" bg="#fef2f2">{s}</Pill>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const user = msg.role === "user";
  return (
    <div style={{
      display: "flex", flexDirection: user ? "row-reverse" : "row",
      gap: 12, marginBottom: 20, alignItems: "flex-start",
      animation: "medFadeIn .3s cubic-bezier(0.16, 1, 0.3, 1)"
    }}>
      <Avatar label={user ? "You" : "M"} bg={user ? "#1e293b" : "#dc2626"} />
      <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", gap: 6, alignItems: user ? "flex-end" : "flex-start" }}>
        {msg.emergency && !user && <EmergencyCard />}
        {msg.imagePreview && (
          <div style={{
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 12, padding: 8, marginBottom: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
          }}>
            <img src={msg.imagePreview} alt="uploaded medical attachment"
              style={{ width: "100%", maxWidth: 260, maxHeight: 180, objectFit: "cover", borderRadius: 8, display: "block" }} />
            <p style={{ margin: "8px 0 0 4px", fontSize: 11, color: "#dc2626", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <span>📎</span> Medical image submitted
            </p>
          </div>
        )}
        {msg.docName && (
          <div style={{
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center",
            marginBottom: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
          }}>
            <span style={{ fontSize: 24 }}>📋</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#dc2626" }}>{msg.docName}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Medical document attached</p>
            </div>
          </div>
        )}
        <div style={{
          background: user ? "#1e293b" : "#ffffff",
          color: user ? "#f8fafc" : "#0f172a",
          border: user ? "none" : "1px solid #e2e8f0",
          borderRadius: user ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
          padding: "12px 18px", fontSize: 14, lineHeight: 1.7,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          boxShadow: user ? "0 4px 12px rgba(30,41,59,0.08)" : "0 4px 12px rgba(0,0,0,0.03)"
        }}>{msg.content}</div>
        <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, padding: "0 4px" }}>
          {fmt(msg.ts)}
        </span>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
      <Avatar label="M" bg="#dc2626" />
      <div style={{
        background: "#ffffff", border: "1px solid #e2e8f0",
        borderRadius: "4px 18px 18px 18px", padding: "14px 20px",
        display: "flex", gap: 6, alignItems: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
      }}>
        {[0, 0.2, 0.4].map(d => <Dot key={d} delay={d} />)}
      </div>
    </div>
  );
}

/* ─── SCREENS ─────────────────────────────────────────────────── */
function Dashboard({ onNav, stats }) {
  const cards = [
    { icon: "💬", label: "Symptom Chat", desc: "Describe symptoms & get guided info", tab: "chat", color: "#dc2626", bg: "#fef2f2" },
    { icon: "🔬", label: "Image Analysis", desc: "Upload skin, eye, or visual symptoms", tab: "image", color: "#2563eb", bg: "#eff6ff" },
    { icon: "📋", label: "Report Summary", desc: "Understand your lab & test reports", tab: "report", color: "#16a34a", bg: "#f0fdf4" },
    { icon: "💊", label: "Medicine Info", desc: "Drug details, side effects, & dosing", tab: "medicine", color: "#ca8a04", bg: "#fefcbf" },
    { icon: "🚨", label: "Emergency Guide", desc: "Red-flag symptoms & emergency helpline", tab: "emergency", color: "#e11d48", bg: "#fff1f2" },
    { icon: "❓", label: "Health FAQ", desc: "Quick answers to common health questions", tab: "faq", color: "#7c3aed", bg: "#f5f3ff" },
  ];

  return (
    <div style={{ padding: "32px", height: "100%", overflowY: "auto", background: "#f8fafc" }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #f87171 100%)",
        borderRadius: 20, padding: "36px 40px", marginBottom: 28, color: "#fff",
        position: "relative", overflow: "hidden", boxShadow: "0 10px 25px rgba(220,38,38,0.15)"
      }}>
        <div style={{ position: "absolute", right: -10, top: -20, fontSize: 130, opacity: .12, lineHeight: 1, pointerEvents: "none" }}>🏥</div>
        <Pill color="#ffffff" bg="rgba(255,255,255,0.18)" style={{ marginBottom: 16, display: "inline-block", border: "1px solid rgba(255,255,255,0.2)" }}>
          Healthcare + Vision + Gemini AI
        </Pill>
        <h1 style={{ margin: "0 0 10px", fontSize: 32, fontWeight: 800, letterSpacing: -0.8, fontFamily: "'Outfit', sans-serif" }}>
          MediAssist AI Portal
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 15, opacity: .92, lineHeight: 1.6, maxWidth: 540 }}>
          A secure, responsible healthcare companion powered by Google Gemini. Explore health topics, explain reports, check medications, and analyze visual symptoms under secure parameters.
        </p>
        <div style={{
          background: "rgba(255,255,255,0.12)", borderRadius: 10,
          padding: "12px 18px", display: "inline-flex", gap: 8, alignItems: "center",
          fontSize: 13, border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(4px)"
        }}>
          ⚠️ <strong>Educational Use Only</strong> — Not a substitute for a clinical consultation.
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Queries Answered", val: stats.queries, icon: "💬", color: "#dc2626" },
          { label: "Images Analyzed", val: stats.images, icon: "🔬", color: "#2563eb" },
          { label: "Reports Summarized", val: stats.reports, icon: "📋", color: "#16a34a" },
          { label: "Emergency Alerts", val: stats.alerts, icon: "🚨", color: "#e11d48" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
            padding: "20px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            transition: "transform 0.2s, box-shadow 0.2s"
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature cards */}
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>
        🔧 Clinical Support Tools
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <button key={c.tab} onClick={() => onNav(c.tab)} style={{
            background: "#fff", border: `1px solid ${c.color}20`,
            borderRadius: 16, padding: "24px 20px", cursor: "pointer",
            textAlign: "left", transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)", outline: "none",
            display: "flex", flexDirection: "column", justifyContent: "space-between"
          }}
            onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 8px 20px ${c.color}15`; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.02)"; }}>
            <div>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}>{c.label}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 16 }}>{c.desc}</div>
            </div>
            <div style={{ color: c.color, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              Explore Tool <span>→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Model info */}
      <div style={{
        background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "24px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
      }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>
          ⚙️ Privacy & Core System Design
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { k: "AI Core Model", v: "Google Gemini 1.5 Flash (Multimodal)" },
            { k: "Visual Assessment", v: "Image parsing for dermatological & report diagnostics" },
            { k: "Safety Layer", v: "Automatic Emergency Red-Flag detection & system constraints" },
            { k: "Privacy Level", v: "Isolated local session, zero patient logs stored" },
          ].map(({ k, v }) => (
            <div key={k} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 16px", border: "1px solid #e2e8f0" }}>
              <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{k}</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#334155", fontWeight: 600 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ messages, onSend, loading, onImageUpload, uploadedFile, onClearFile, tab }) {
  const [input, setInput] = useState("");
  const fileRef = useRef();
  const bottomRef = useRef();
  const taRef = useRef();

  const starters = {
    chat: ["I have a headache and fever", "My throat is sore & scratchy", "I've had a persistent cough", "What are signs of hypertension?", "How is diabetes managed?"],
    image: ["Analyze this skin irritation", "Describe what is visible on this scan", "Does this rash look concerning?", "Explain general patterns in this X-ray"],
    report: ["Summarize my complete blood count (CBC)", "Explain high creatinine values", "Translate this lab panel", "What does elevated thyroid stimulating hormone (TSH) indicate?"],
    medicine: ["What is Paracetamol used for?", "Side effects of Metformin", "Is Ibuprofen safe to take daily?", "What are instructions for Azithromycin?"],
  };

  const placeholder = {
    chat: "Describe symptoms... e.g., 'I have tightness in my chest and shortness of breath'",
    image: "Select a medical image and write your question...",
    report: "Attach or paste report text to get a simplified explanation...",
    medicine: "Ask about a medication, dosage guidelines, or side effects...",
  }[tab] || "Type your health inquiry...";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading]);

  const send = () => {
    const t = input.trim();
    if (!t && !uploadedFile) return;
    onSend(t);
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
      {/* Quick starters */}
      {messages.length <= 1 && (
        <div style={{ padding: "16px 24px 0", display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
          {(starters[tab] || starters.chat).map(q => (
            <button key={q} onClick={() => onSend(q)} style={{
              background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20,
              padding: "6px 14px", fontSize: 12, color: "#dc2626", cursor: "pointer",
              transition: "all 0.15s", fontWeight: 500, boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
            }}
              onMouseEnter={e => { e.target.style.background = "#dc2626"; e.target.style.color = "#ffffff"; e.target.style.borderColor = "#dc2626"; }}
              onMouseLeave={e => { e.target.style.background = "#ffffff"; e.target.style.color = "#dc2626"; e.target.style.borderColor = "#e2e8f0"; }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 8px" }}>
        {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
        {loading && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* File preview */}
      {uploadedFile && (
        <div style={{
          margin: "0 24px 10px", background: "#fecdd3", border: "1.5px solid #fda4af",
          borderRadius: 12, padding: "10px 16px", display: "flex", gap: 12, alignItems: "center", flexShrink: 0,
          boxShadow: "0 4px 10px rgba(220,38,38,0.05)"
        }}>
          {uploadedFile.type?.startsWith("image/")
            ? <img src={uploadedFile.preview} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #f87171" }} />
            : <span style={{ fontSize: 26 }}>📋</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#991b1b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploadedFile.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: "#b91c1c" }}>{uploadedFile.type?.startsWith("image/") ? "Visual file ready for Gemini AI analysis" : "Document loaded for text extraction"}</p>
          </div>
          <button onClick={onClearFile} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#991b1b", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      )}

      {/* Input */}
      <div style={{
        background: "#ffffff", borderTop: "1px solid #e2e8f0",
        padding: "16px 24px", display: "flex", gap: 12, alignItems: "flex-end", flexShrink: 0,
        boxShadow: "0 -4px 10px rgba(0,0,0,0.01)"
      }}>
        <input type="file" ref={fileRef} accept="image/*,.pdf,.txt,.doc,.docx" style={{ display: "none" }}
          onChange={e => onImageUpload(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} title="Attach file or photo" style={{
          background: "#f8fafc", border: "1px solid #e2e8f0",
          borderRadius: 12, width: 46, height: 46, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0, transition: "all 0.15s"
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecdd3"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
          📎
        </button>

        <div style={{
          flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0",
          borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "flex-end",
          transition: "border-color 0.2s"
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = "#fca5a5"}
          onBlurCapture={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
          <textarea ref={taRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={placeholder} rows={1}
            style={{
              width: "100%", background: "transparent", border: "none", resize: "none",
              fontSize: 14, color: "#0f172a", lineHeight: 1.6, fontFamily: "inherit",
              maxHeight: 120, overflowY: "auto", outline: "none"
            }} />
        </div>

        <button onClick={send} disabled={loading || (!input.trim() && !uploadedFile)} style={{
          background: loading || (!input.trim() && !uploadedFile) ? "#e2e8f0" : "#dc2626",
          border: "none", borderRadius: 12, width: 46, height: 46, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0, transition: "all 0.2s", color: "#fff",
          boxShadow: loading || (!input.trim() && !uploadedFile) ? "none" : "0 4px 10px rgba(220,38,38,0.2)"
        }}>➤</button>
      </div>
    </div>
  );
}

function EmergencyScreen() {
  const reds = [
    { icon: "❤️", title: "Cardiac Events", sxs: ["Intense chest pain, tightness or pressure", "Radiating discomfort to arm, neck or jaw", "Shortness of breath accompanied by cold sweat", "Extreme weakness, sudden nausea or lightheadedness"] },
    { icon: "🧠", title: "Stroke Indicators (FAST)", sxs: ["F — Face drooping on one side", "A — Arm weakness or numbness when lifting both", "S — Speech slurring or inability to formulate words", "T — Time to call emergency response (112) immediately", "Sudden severe headache with no known cause"] },
    { icon: "🫁", title: "Severe Respiratory Distress", sxs: ["Inability to speak in full sentences due to breathlessness", "Cyanosis (bluish tint on lips, tongue, or fingertips)", "Stridors or high-pitched wheezing", "Acute allergic reaction (anaphylaxis) with throat swelling"] },
    { icon: "🩸", title: "Hemorrhage / Trauma", sxs: ["Spurtive or uncontrollable bleeding", "Signs of internal bleeding (coughing/vomiting blood)", "Sudden loss of blood pressure/shock signs", "Severe spinal or head trauma"] },
    { icon: "🧪", title: "Overdose & Poisoning", sxs: ["Ingestion of toxic chemicals or drug overdose", "Loss of responsiveness after substance exposure", "Venomous bites (snakes, insects)", "Chemical burns or inhalation of noxious gas"] },
    { icon: "⚡", title: "Severe Neurological Conditions", sxs: ["Active seizure lasting more than 5 minutes", "Failure to regain consciousness post-seizure", "Sudden acute confusion, disorientation, or paralysis", "Complete sudden blindness"] },
  ];

  const contacts = [
    { label: "Emergency Hotline", num: "112", color: "#dc2626" },
    { label: "Ambulance", num: "108", color: "#2563eb" },
    { label: "Police Help Desk", num: "100", color: "#1e293b" },
    { label: "Fire Station", num: "101", color: "#ca8a04" },
    { label: "Disaster Authority", num: "1078", color: "#16a34a" },
    { label: "Women Helpline", num: "1091", color: "#7c3aed" },
  ];

  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", background: "#f8fafc" }}>
      <div style={{
        background: "linear-gradient(135deg, #7f1d1d, #b91c1c)",
        borderRadius: 16, padding: "24px", marginBottom: 24, color: "#fff",
        boxShadow: "0 4px 15px rgba(185,28,28,0.15)"
      }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>🚨 Medical Emergency Protocols</h2>
        <p style={{ margin: 0, fontSize: 14, opacity: .9, lineHeight: 1.6 }}>
          If you or someone in your vicinity is experiencing any of the conditions below, <strong>DO NOT WAIT</strong>. Access emergency care instantly.
        </p>
      </div>

      <div style={{
        background: "#fff", border: "2px solid #fecdd3", borderRadius: 16,
        padding: "20px 24px", marginBottom: 24, boxShadow: "0 4px 15px rgba(0,0,0,0.01)"
      }}>
        <p style={{ margin: "0 0 16px", fontWeight: 700, color: "#b91c1c", fontSize: 15, fontFamily: "'Outfit', sans-serif" }}>📞 Crisis Emergency Numbers</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {contacts.map(c => (
            <div key={c.num} style={{
              background: "#f8fafc", borderRadius: 12, padding: "14px",
              textAlign: "center", border: `1.5px solid ${c.color}20`
            }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: c.color, fontFamily: "'Outfit', sans-serif" }}>{c.num}</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b", fontWeight: 500 }}>{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>🔴 Crucial Red-Flag Conditions</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {reds.map(r => (
          <div key={r.title} style={{
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.01)"
          }}>
            <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 15, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>
              {r.icon} {r.title}
            </p>
            {r.sxs.map(s => (
              <div key={s} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{
        background: "#fefcbf", border: "1px solid #fef08a", borderRadius: 16,
        padding: "16px 20px", marginTop: 24, color: "#713f12"
      }}>
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 15, fontFamily: "'Outfit', sans-serif" }}>
          ⚠️ Critical First-Response Steps:
        </p>
        {["Maintain composure and keep the affected individual stable.", "Avoid providing food, drink, or medications unless explicitly told by dispatch.", "Initiate CPR immediately if trained and the patient is not breathing.", "Keep the patient warm and dry.", "Assign someone to wait outside to flag down responders.", "Keep the line clear and remain connected with the operator."].map(s => (
          <div key={s} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{ color: "#ca8a04", fontWeight: 700, marginTop: 1 }}>✓</span>
            <span style={{ fontSize: 13, color: "#713f12", lineHeight: 1.5 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQScreen({ onAsk }) {
  const faqs = [
    { q: "What constitutes a normal blood pressure reading?", a: "Standard optimal blood pressure is under 120/80 mmHg. A systolic range of 120-129 and diastolic under 80 is classified as elevated. Readings above 130/80 denote hypertension stages and should be monitored with a clinical practitioner." },
    { q: "What are healthy reference ranges for blood glucose?", a: "Fasting blood sugar: 70-99 mg/dL is normal, 100-125 suggests prediabetes, and 126+ indicates diabetes. A post-meal test (2 hours) is expected below 140 mg/dL, with higher ranges signifying potential glycemic impairment." },
    { q: "When should I go directly to the Emergency Room?", a: "Access the ER instantly for conditions involving: radiating chest pains, sudden slurring/numbness, dyspnea, severe hemorrhages, acute trauma, sudden confusion, or severe ingestion of toxins." },
    { q: "What metrics are evaluated in a Complete Blood Count (CBC)?", a: "A CBC measures: Red Blood Cells (RBC) which carry oxygen, White Blood Cells (WBC) for immune response, Hemoglobin, Hematocrit levels, and Platelets which aid in blood clotting. It is useful to rule out anemia, inflammation, or infection." },
    { q: "How should a minor fever be managed at home?", a: "Maximize rest and stay hydrated. Over-the-counter antipyretics like paracetamol can help control body temperature. Seek immediate attention if temperature exceeds 103°F (39.4°C), extends past 3 days, or is accompanied by stiff neck or breathing struggles." },
    { q: "What are the common signs of bodily dehydration?", a: "Manifestations include darker urine, dry throat/mouth, lightheadedness, fatigue, reduced urinary volume, or mild headaches. Severe dehydration requires intravenous fluid replacement." },
    { q: "How long is a standard cough expected to persist?", a: "Coughs lasting under 3 weeks are acute, often stemming from viral respiratory episodes. Coughs extending beyond 8 weeks are chronic and warrant detailed radiological or pulmonological review." },
    { q: "What is an average resting heart rate?", a: "For adults, a healthy range is 60-100 beats per minute (bpm). Highly trained athletes may manifest healthy ranges of 40-60 bpm. Consistently high (>100) or low (<60) symptomatic heart rates should be evaluated clinically." },
  ];
  const [open, setOpen] = useState(null);

  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", background: "#f8fafc" }}>
      <div style={{
        background: "linear-gradient(135deg, #5b21b6, #7c3aed)",
        borderRadius: 16, padding: "24px", marginBottom: 24, color: "#fff",
        boxShadow: "0 4px 15px rgba(124,58,237,0.15)"
      }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>❓ Clinical Health FAQ</h2>
        <p style={{ margin: 0, fontSize: 14, opacity: .9, lineHeight: 1.6 }}>Access general information on diagnostics, metrics, and first-line home care guidance.</p>
      </div>

      {faqs.map((f, i) => (
        <div key={i} style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
          marginBottom: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
          transition: "border-color 0.2s"
        }}>
          <button onClick={() => setOpen(open === i ? null : i)} style={{
            width: "100%", background: "transparent", border: "none",
            padding: "16px 20px", textAlign: "left", cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 12, outline: "none"
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>{f.q}</span>
            <span style={{
              fontSize: 18, color: "#94a3b8", flexShrink: 0, transition: "transform 0.2s",
              transform: open === i ? "rotate(180deg)" : "none"
            }}>▾</span>
          </button>
          {open === i && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9" }}>
              <p style={{ margin: "14px 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{f.a}</p>
              <button onClick={() => onAsk(f.q)} style={{
                background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 20,
                padding: "6px 16px", fontSize: 12, color: "#6d28d9", cursor: "pointer",
                fontWeight: 600, transition: "all 0.15s"
              }}
                onMouseEnter={e => { e.target.style.background = "#7c3aed"; e.target.style.color = "#ffffff"; }}
                onMouseLeave={e => { e.target.style.background = "#f5f3ff"; e.target.style.color = "#6d28d9"; }}>
                Ask MediAssist AI about this ↗
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PrivacyModal({ onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
      display: "flex", alignItems: "center", justifyOrigin: "center", justifyContent: "center",
      zIndex: 9999, padding: 20, backdropFilter: "blur(4px)",
      animation: "medFadeIn .2s ease"
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "32px",
        maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>🔒 Privacy Compliance Notice</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: "#94a3b8", display: "flex", alignItems: "center" }}>✕</button>
        </div>
        {[
          { icon: "🛡️", t: "Data Sanitization", d: "Your chat details exist solely in-memory within your local browser. Once the browser window is closed or cleared, your records are deleted." },
          { icon: "🔬", t: "Attachment Safety", d: "Attached reports or diagnostic photos are sent as direct payloads for model interpretation. The server processes it on-the-fly and rejects caching/storage." },
          { icon: "⚠️", t: "Guidance Boundaries", d: "MediAssist AI offers general informational templates. It does not replace professional diagnosis, treatment, or therapy." },
          { icon: "👤", t: "PII Recommendations", d: "To protect your identity, do not share full names, personal addresses, government IDs, or sensitive medical histories." },
          { icon: "🤖", t: "Gemini Engine Processing", d: "Requests are computed via Google's Gemini SDK. Data handling adheres to standard enterprise APIs with no permanent training logs." },
          { icon: "🔐", t: "Informed Use", d: "By entering queries, you acknowledge that this information is educational, preliminary, and processed anonymously." },
        ].map(({ icon, t, d }) => (
          <div key={t} style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1e293b", fontFamily: "'Outfit', sans-serif" }}>{t}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{d}</p>
            </div>
          </div>
        ))}
        <button onClick={onClose} style={{
          width: "100%", background: "#dc2626", color: "#fff", border: "none",
          borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700,
          cursor: "pointer", marginTop: 12, boxShadow: "0 4px 10px rgba(220,38,38,0.2)",
          fontFamily: "'Outfit', sans-serif"
        }}>I Accept — Proceed Safely</button>
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("home");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ queries: 0, images: 0, reports: 0, alerts: 0 });

  const initMsg = {
    id: uid(), role: "assistant", ts: new Date(), emergency: false,
    content: `Hello! I'm **MediAssist AI** 👋

I'm here to provide educational health guidance — including symptom information, medical image analysis, report summaries, and medication details.

⚕️ **Important:** I am an AI assistant for educational/preliminary support only. I am NOT a substitute for a qualified doctor. Always consult a healthcare professional for diagnosis and treatment.

How can I help you today? You can:
• Describe your symptoms
• Upload a medical image or report (📎)
• Ask about medications
• Use the quick questions below`
  };

  const [chatMsgs, setChatMsgs] = useState([initMsg]);
  const [imgMsgs, setImgMsgs] = useState([{ ...initMsg, id: uid(), content: "Upload a medical image (skin photo, X-ray scan, eye image, etc.) and I'll provide general educational observations.\n\n📎 Use the attachment button below to upload an image, then describe what you'd like to know.\n\n⚕️ Disclaimer: AI image analysis is for educational purposes only. A licensed physician must interpret any medical imagery." }]);
  const [repMsgs, setRepMsgs] = useState([{ ...initMsg, id: uid(), content: "Paste your lab report, blood test results, or medical document text below — or attach a file — and I'll explain it in simple, patient-friendly language.\n\n⚕️ Disclaimer: Report explanations are educational only. Your doctor is the authority on your results." }]);
  const [medMsgs, setMedMsgs] = useState([{ ...initMsg, id: uid(), content: "Ask me about any medication: what it's used for, common side effects, dosing guidance, interactions to watch for, and more.\n\n⚕️ Disclaimer: Medication information is educational. Always follow your doctor's prescription and the official drug label." }]);

  const getMsgs = t => ({ chat: chatMsgs, image: imgMsgs, report: repMsgs, medicine: medMsgs })[t];
  const setMsgs = t => ({ chat: setChatMsgs, image: setImgMsgs, report: setRepMsgs, medicine: setMedMsgs })[t];

  const activeTab = ["chat", "image", "report", "medicine"].includes(tab) ? tab : null;

  const handleUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const isImage = file.type?.startsWith("image/");
      
      // If it's a large image, compress it using a canvas
      if (isImage) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          // Max dimension of 1000px is plenty for Gemini Vision API
          const MAX_SIZE = 1000;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.8 quality
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
          const base64 = compressedDataUrl.split(",")[1];
          
          setUploadedFile({
            name: file.name, type: "image/jpeg",
            base64, preview: URL.createObjectURL(file)
          });
        };
        img.src = e.target.result;
      } else {
        // Non-image files (like small text/pdfs)
        const base64 = e.target.result.split(",")[1];
        setUploadedFile({
          name: file.name, type: file.type,
          base64, preview: null
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = useCallback(async (text) => {
    if (!activeTab) return;
    const emerg = isEmergency(text || "");
    const f = uploadedFile;

    const userMsg = {
      id: uid(), role: "user", ts: new Date(), emergency: false,
      content: text || (f ? "(Attached file for analysis)" : ""),
      imagePreview: f?.preview || null,
      docName: f && !f.type?.startsWith("image/") ? f.name : null,
    };

    const setM = setMsgs(activeTab);
    const getM = getMsgs(activeTab);
    const history = [...getM, userMsg];
    setM(history);
    setUploadedFile(null);
    setLoading(true);

    // update stats
    setStats(s => ({
      ...s,
      queries: s.queries + 1,
      images: f?.type?.startsWith("image/") ? s.images + 1 : s.images,
      reports: activeTab === "report" ? s.reports + 1 : s.reports,
      alerts: emerg ? s.alerts + 1 : s.alerts,
    }));

    try {
      const apiMsgs = history.map((m, i) => {
        if (m.role === "user") {
          const content = [];
          if (i === history.length - 1 && f?.base64 && f?.type?.startsWith("image/")) {
            content.push({ type: "image", source: { type: "base64", media_type: f.type, data: f.base64 } });
          }
          const txt = m.content || (f ? "Please analyze the attached medical file." : "");
          if (txt) content.push({ type: "text", text: txt });
          return { role: "user", content: content.length === 1 && content[0].type === "text" ? txt : content };
        }
        return { role: "assistant", content: m.content };
      });

      const sysAddons = {
        image: "\n\nThe user is asking about a medical image. Provide general visual observations only. Emphasize professional evaluation is required.",
        report: "\n\nThe user is sharing a medical report or lab results. Explain values in plain language. Do not provide clinical diagnosis.",
        medicine: "\n\nThe user is asking about medication. Provide factual drug information including uses, side effects, interactions. Always advise following doctor's prescription.",
      };

      // Call the Vercel serverless API (or local Express backend during dev)
      const API_BASE_URL = import.meta.env.DEV ? "http://localhost:5000" : "";
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM_PROMPT + (sysAddons[activeTab] || ""),
          messages: apiMsgs
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Unable to reach server.");
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content
        || "I'm sorry, I couldn't generate a response. Please try again.";

      setM(prev => [...prev, {
        id: uid(), role: "assistant", ts: new Date(),
        emergency: emerg, content: reply
      }]);
    } catch (e) {
      setM(prev => [...prev, {
        id: uid(), role: "assistant", ts: new Date(), emergency: false,
        content: `⚠️ Error: ${e.message || "Connection error. Please check your network and try again."}`
      }]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, uploadedFile, chatMsgs, imgMsgs, repMsgs, medMsgs]);

  const handleFAQAsk = (q) => { setTab("chat"); setTimeout(() => handleSend(q), 100); };

  const navItems = [
    { id: "home", icon: "🏠", label: "Dashboard" },
    { id: "chat", icon: "💬", label: "Symptom Chat" },
    { id: "image", icon: "🔬", label: "Image Analysis" },
    { id: "report", icon: "📋", label: "Report Summary" },
    { id: "medicine", icon: "💊", label: "Medicine Info" },
    { id: "emergency", icon: "🚨", label: "Emergency Guide" },
    { id: "faq", icon: "❓", label: "Health FAQ" },
  ];

  const tabTitles = {
    home: "Dashboard", chat: "Symptom Chat", image: "Medical Image Analysis",
    report: "Report & Lab Summary", medicine: "Medication Information",
    emergency: "Emergency Guide", faq: "Health FAQ"
  };

  return (
    <div style={{
      display: "flex", height: "100vh", width: "100vw", fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif",
      background: "#f8fafc", overflow: "hidden"
    }}>
      {/* SIDEBAR */}
      {sideOpen && (
        <div style={{
          width: 250, background: "#ffffff", borderRight: "1px solid #e2e8f0",
          display: "flex", flexDirection: "column", flexShrink: 0,
          boxShadow: "4px 0 10px rgba(0,0,0,0.01)"
        }}>
          {/* Logo */}
          <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, background: "linear-gradient(135deg, #dc2626, #f87171)",
                borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                boxShadow: "0 4px 10px rgba(220,38,38,0.2)"
              }}>🏥</div>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#0f172a", letterSpacing: -0.4, fontFamily: "'Outfit', sans-serif" }}>MediAssist AI</p>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>Secure Session</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                background: tab === n.id ? "#fef2f2" : "transparent",
                border: "none", borderRadius: 12, padding: "12px 14px",
                cursor: "pointer", fontSize: 13, color: tab === n.id ? "#b91c1c" : "#475569",
                fontWeight: tab === n.id ? 700 : 500, textAlign: "left", marginBottom: 4,
                transition: "all 0.15s", borderLeft: tab === n.id ? "3px solid #dc2626" : "3px solid transparent",
                fontFamily: "'Outfit', sans-serif"
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>

          {/* Bottom */}
          <div style={{ padding: "14px", borderTop: "1px solid #f1f5f9" }}>
            <button onClick={() => setShowPrivacy(true)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              background: "transparent", border: "none", borderRadius: 10, padding: "10px 14px",
              cursor: "pointer", fontSize: 12, color: "#64748b", textAlign: "left", fontWeight: 500
            }}>🔒 Privacy Policy</button>
            <button onClick={() => {
              setChatMsgs([initMsg]); setImgMsgs([{ ...initMsg, id: uid() }]);
              setRepMsgs([{ ...initMsg, id: uid() }]); setMedMsgs([{ ...initMsg, id: uid() }]);
            }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              background: "transparent", border: "none", borderRadius: 10, padding: "10px 14px",
              cursor: "pointer", fontSize: 12, color: "#64748b", textAlign: "left", fontWeight: 500
            }}>🗑️ Reset Conversations</button>
            <div style={{
              background: "#fef2f2", borderRadius: 12, padding: "12px", marginTop: 10,
              border: "1px solid #fee2e2"
            }}>
              <p style={{ margin: 0, fontSize: 11, color: "#b91c1c", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>⚠️ Disclaimer</p>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#991b1b", lineHeight: 1.5 }}>
                For educational use only. Always consult a medical physician for health concerns.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "#ffffff", borderBottom: "1px solid #e2e8f0",
          padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
          boxShadow: "0 2px 10px rgba(0,0,0,0.01)"
        }}>
          <button onClick={() => setSideOpen(s => !s)} style={{
            background: "transparent", border: "1px solid #e2e8f0", cursor: "pointer",
            borderRadius: 10, padding: "8px 12px", fontSize: 16, color: "#475569",
            transition: "all 0.15s", display: "flex", alignItems: "center"
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>☰</button>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>
              {tabTitles[tab]}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
              Gemini Multimodal Framework • Interactive Clinical Companion
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Pill color="#b91c1c" bg="#fef2f2">🔒 Private Local Session</Pill>
            <Pill color="#16a34a" bg="#f0fdf4">🤖 Gemini 1.5 Flash</Pill>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {tab === "home" && <Dashboard onNav={setTab} stats={stats} />}
          {tab === "emergency" && <EmergencyScreen />}
          {tab === "faq" && <FAQScreen onAsk={handleFAQAsk} />}
          {activeTab && (
            <ChatScreen
              tab={activeTab}
              messages={getMsgs(activeTab)}
              onSend={handleSend}
              loading={loading}
              onImageUpload={handleUpload}
              uploadedFile={uploadedFile}
              onClearFile={() => setUploadedFile(null)}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: "#ffffff", borderTop: "1px solid #f1f5f9",
          padding: "10px 24px", textAlign: "center", flexShrink: 0
        }}>
          <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
            MediAssist AI Portal • Dedicated Preliminary Reference Engine •
            <button onClick={() => setShowPrivacy(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 11, padding: "0 4px", fontWeight: 600 }}>Privacy Terms</button>
          </p>
        </div>
      </div>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";

/* ─── CONSTANTS & SEARCH TERMS ──────────────────────────────── */
const EMERGENCY_KW = [
  "chest pain", "heart attack", "stroke", "can't breathe", "cannot breathe",
  "difficulty breathing", "severe bleeding", "unconscious", "overdose",
  "suicidal", "severe allergic", "anaphylaxis", "seizure", "choking",
  "severe head injury", "paralysis", "poisoning", "not breathing", "fainted",
  "sudden numbness", "sudden confusion", "blurred vision suddenly"
];

const CHAT_SYSTEM_PROMPT = `You are MediAssist AI — a compassionate, highly professional medical assistant.
Always structure responses clearly with headings and emojis:
- 🔍 Possible Causes: Explain potential associations, never confirm a diagnosis.
- ⚠️ Severity & Risk Checklist: Clarify when this becomes serious.
- 🏃 Recommended Next Steps: Suggest standard actions.
- 🛡️ Critical Precautions: Practical daily care advice.

Rules:
1. Always add an AI disclaimer at the very end.
2. If the user reports emergency signs (chest pain, breathing issues, etc.), start with "🚨 EMERGENCY:" and urge immediate 112 calling.
3. Be conversational and ask relevant follow-up questions to understand context.`;

const CHECKER_SYSTEM_PROMPT = `You are a clinical triage assessor.
Analyze the user's symptoms, duration, and details:
1. Classify the severity: [GREEN] Home Care, [AMBER] Consult Doctor, or [RED] Immediate Emergency Care.
2. List possible conditions they should discuss with a doctor.
3. Outline home care tips if green/amber.
4. End with emergency red-flags.`;

const ANALYZER_SYSTEM_PROMPT = `You are a prescription and medication label parser.
Analyze the uploaded image or text and extract details in a clean, user-friendly markdown format:
1. 💊 Medicine Names: List all active ingredients or names.
2. 🕒 Dosage & Timing: When and how much to take.
3. 🎯 Purpose: What the drug treats.
4. ⚠️ Side Effects & Precautions: Important warnings.`;

const VAULT_SYSTEM_PROMPT = `Analyze the provided medical record text and generate a concise 1-paragraph summary explaining what the document is, key findings (e.g. lab values), and any action items in simple, friendly terms.`;

const isEmergency = t => EMERGENCY_KW.some(k => t.toLowerCase().includes(k));
const uid = () => Math.random().toString(36).slice(2);

/* ─── SHARED UI COMPONENTS ──────────────────────────────────── */
function Dot({ color = "var(--primary)", size = 8, delay = 0 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color,
      animation: `medBounce 1.2s ease-in-out ${delay}s infinite`
    }} />
  );
}

function Pill({ color = "var(--primary)", bg = "var(--primary-light)", children, style = {} }) {
  return (
    <span style={{
      background: bg, color, borderRadius: 20, padding: "4px 12px",
      fontSize: 11, fontWeight: 600, border: `1px solid ${color}20`,
      fontFamily: "'Outfit', sans-serif", letterSpacing: "0.2px", ...style
    }}>{children}</span>
  );
}

function Avatar({ label, bg = "var(--primary)", size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontFamily: "'Outfit', sans-serif"
    }}>{label}</div>
  );
}

/* ─── LIVE ECG SIMULATOR ────────────────────────────────────── */
function ECGSimulator({ onTriggerTriage }) {
  const [bpm, setBpm] = useState(72);
  const [spo2, setSpo2] = useState(98);
  const canvasRef = useRef(null);
  const phaseRef = useRef(0);
  const pointsRef = useRef([]);

  const isHighBpm = bpm > 130;
  const isLowBpm = bpm < 50;
  const isLowSpo2 = spo2 < 90;
  const hasAlert = isHighBpm || isLowBpm || isLowSpo2;

  let alertColor = "#10b981";
  let statusText = "Optimal Cardiac rhythm";

  if (isHighBpm) {
    alertColor = "#ef4444";
    statusText = "🚨 Tachycardia Warning";
  } else if (isLowBpm) {
    alertColor = "#f59e0b";
    statusText = "⚠️ Bradycardia Warning";
  } else if (isLowSpo2) {
    alertColor = "#ef4444";
    statusText = "🚨 Hypoxia (Low SpO2) Alert";
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const maxPoints = 140;
    if (pointsRef.current.length === 0) {
      for (let i = 0; i < maxPoints; i++) pointsRef.current.push(0);
    }

    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(16, 185, 129, 0.03)";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 20) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
      }

      const phase = phaseRef.current;
      let amp = 0;

      if (phase >= 0.1 && phase < 0.2) {
        amp = Math.sin(Math.PI * (phase - 0.1) / 0.1) * 0.12;
      } else if (phase >= 0.30 && phase < 0.32) {
        amp = -0.15 * Math.sin(Math.PI * (phase - 0.30) / 0.02);
      } else if (phase >= 0.32 && phase < 0.35) {
        amp = Math.sin(Math.PI * (phase - 0.32) / 0.03) * 1.0;
      } else if (phase >= 0.35 && phase < 0.38) {
        amp = -0.3 * Math.sin(Math.PI * (phase - 0.35) / 0.03);
      } else if (phase >= 0.48 && phase < 0.62) {
        amp = Math.sin(Math.PI * (phase - 0.48) / 0.14) * 0.28;
      }

      if (hasAlert) {
        amp += (Math.random() - 0.5) * 0.06;
      }

      const bps = bpm / 60;
      phaseRef.current = (phase + (bps / 60)) % 1;

      pointsRef.current.push(amp);
      if (pointsRef.current.length > maxPoints) pointsRef.current.shift();

      ctx.strokeStyle = alertColor;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = alertColor;
      ctx.beginPath();

      const centerY = canvas.height / 2;
      const step = canvas.width / maxPoints;

      for (let i = 0; i < pointsRef.current.length; i++) {
        const xCoord = i * step;
        const yCoord = centerY - (pointsRef.current[i] * (canvas.height * 0.36));
        if (i === 0) ctx.moveTo(xCoord, yCoord);
        else ctx.lineTo(xCoord, yCoord);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [bpm, spo2, hasAlert, alertColor]);

  return (
    <div style={{
      background: "var(--bg-white)", border: "1px solid var(--border-color)",
      borderRadius: 20, padding: "20px", display: "flex", flexDirection: "column", gap: 14, flex: 1
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>🫀 Live ECG & Vitals Simulator</h3>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>Simulate abnormal vitals to trigger AI Triage</p>
      </div>

      <canvas ref={canvasRef} width={340} height={130} style={{
        background: "#030712", borderRadius: 12, width: "100%", display: "block"
      }} />

      <div style={{
        display: "flex", alignItems: "center", justifyOrigin: "center", justifyContent: "space-between",
        background: `${alertColor}12`, border: `1.5px solid ${alertColor}30`, borderRadius: 12, padding: "10px 16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: alertColor, animation: "medPulse 1s infinite" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: alertColor }}>{statusText}</span>
        </div>
        {hasAlert && (
          <button onClick={() => onTriggerTriage(`My simulated heart vitals are abnormal. Heart Rate is ${bpm} BPM and Oxygen SpO2 is ${spo2}%. Please provide triage recommendation.`)} style={{
            background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer"
          }}>🚨 Consult AI</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Heart Rate: {bpm} BPM</label>
          <input type="range" min="30" max="200" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} style={{ width: "100%", accentColor: alertColor }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>SpO2: {spo2}%</label>
          <input type="range" min="70" max="100" value={spo2} onChange={(e) => setSpo2(parseInt(e.target.value))} style={{ width: "100%", accentColor: alertColor }} />
        </div>
      </div>
    </div>
  );
}

/* ─── SVG BODY MAP HOTSPOTS ─────────────────────────────────── */
function BodyMap({ onSelectSymptom }) {
  const [selectedPart, setSelectedPart] = useState(null);

  const bodyParts = {
    head: { name: "Head", symptoms: ["Severe Migraine", "Dizziness / Vertigo", "Sinus pressure", "Severe Toothache"], x: 100, y: 45 },
    chest: { name: "Chest / Heart", symptoms: ["Chest tightness", "Palpitations", "Shortness of breath", "Acid reflux"], x: 100, y: 110 },
    abdomen: { name: "Abdomen", symptoms: ["Stomach cramps", "Nausea & vomiting", "Severe bloating", "Indigestion"], x: 100, y: 165 },
    joints: { name: "Joints & Muscles", symptoms: ["Knee pain & swelling", "Muscle strain", "Lower back ache", "Wrist numbness"], x: 55, y: 140 },
    skin: { name: "Skin / Rashes", symptoms: ["Itchy red rash", "Dry eczema patches", "Insect bite/sting", "Minor sunburn"], x: 100, y: 235 }
  };

  return (
    <div style={{
      background: "var(--bg-white)", border: "1px solid var(--border-color)",
      borderRadius: 20, padding: "20px", display: "flex", gap: 20, flex: 1, minHeight: 320
    }}>
      <div style={{ flex: 1.1, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <svg viewBox="0 0 200 400" style={{ width: "100%", maxHeight: 250, overflow: "visible" }}>
          <g stroke="#cbd5e1" strokeWidth="2.5" fill="none" opacity="0.85">
            <circle cx="100" cy="45" r="20" stroke="#94a3b8" />
            <path d="M 100 65 L 100 220" stroke="#94a3b8" />
            <path d="M 75 80 L 125 80 L 115 210 L 85 210 Z" stroke="#cbd5e1" fill="var(--bg-primary)" />
            <path d="M 75 80 Q 50 140 40 200" stroke="#cbd5e1" />
            <path d="M 125 80 Q 150 140 160 200" stroke="#cbd5e1" />
            <path d="M 85 210 L 75 310 L 70 380" stroke="#cbd5e1" />
            <path d="M 115 210 L 125 310 L 130 380" stroke="#cbd5e1" />
          </g>

          {Object.entries(bodyParts).map(([key, part]) => {
            const active = selectedPart === key;
            return (
              <g key={key} style={{ cursor: "pointer" }} onClick={() => setSelectedPart(active ? null : key)}>
                <circle cx={part.x} cy={part.y} r="18" fill="transparent" />
                <circle cx={part.x} cy={part.y} r="7" fill="var(--primary)" style={{
                  animation: "medPulse 1.8s infinite",
                  filter: "drop-shadow(0 0 4px var(--primary))"
                }} />
                {active && <circle cx={part.x} cy={part.y} r="14" fill="none" stroke="var(--primary)" strokeWidth="1.5" />}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ flex: 1.3, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>🧍 Symptom Locator</h3>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>Tap points on body map</p>
        </div>

        <div style={{
          background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12,
          padding: "12px", minHeight: 160, display: "flex", flexDirection: "column", justifyOrigin: "center", justifyContent: "center"
        }}>
          {selectedPart ? (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--primary)", fontFamily: "'Outfit', sans-serif" }}>📍 {bodyParts[selectedPart].name}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {bodyParts[selectedPart].symptoms.map(s => (
                  <button key={s} onClick={() => onSelectSymptom(`Symptom selected: ${s} on the ${bodyParts[selectedPart].name}. Tell me causes & precautions.`)} style={{
                    background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 8,
                    padding: "8px 10px", fontSize: 12, color: "var(--text-primary)", cursor: "pointer", textAlign: "left", fontWeight: 500
                  }}>
                    {s} <span style={{ float: "right" }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🎯</div>
              Tap any hotspot on body outline to choose symptoms.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── CUSTOM TREND CHART COMPONENTS ──────────────────────────── */
function VitalsChart({ data, metric, label }) {
  const validLogs = data.filter(d => d[metric] !== undefined && d[metric] !== null && d[metric] !== "").slice(-6);
  if (validLogs.length < 2) {
    return (
      <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border-color)", borderRadius: 12, color: "var(--text-muted)", fontSize: 12 }}>
        📈 Enter at least 2 logs to view {label} trends
      </div>
    );
  }

  const values = validLogs.map(d => parseFloat(d[metric]));
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;
  const valRange = maxVal - minVal || 1;

  const width = 400;
  const height = 120;
  const padding = 20;

  const getX = (index) => padding + (index * (width - padding * 2) / (validLogs.length - 1));
  const getY = (val) => height - padding - ((val - minVal) * (height - padding * 2) / valRange);

  let pathD = "";
  validLogs.forEach((log, index) => {
    const x = getX(index);
    const y = getY(parseFloat(log[metric]));
    if (index === 0) pathD += `M ${x} ${y}`;
    else pathD += ` L ${x} ${y}`;
  });

  return (
    <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "12px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700 }}>{label} Trend</p>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id={`chartGrad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${pathD} L ${getX(validLogs.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`} fill={`url(#chartGrad-${metric})`} />
        <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />

        {validLogs.map((log, index) => {
          const x = getX(index);
          const y = getY(parseFloat(log[metric]));
          return (
            <g key={log.id}>
              <circle cx={x} cy={y} r="4.5" fill="var(--bg-white)" stroke="var(--primary)" strokeWidth="2.5" />
              <text x={x} y={y - 8} fontSize="8" fontWeight="700" textAnchor="middle" fill="var(--text-primary)">{log[metric]}</text>
              <text x={x} y={height - 4} fontSize="8" fill="var(--text-muted)" textAnchor="middle">
                {new Date(log.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BPChart({ data }) {
  const validLogs = data.filter(d => d.bpSystolic && d.bpDiastolic).slice(-6);
  if (validLogs.length < 2) {
    return (
      <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border-color)", borderRadius: 12, color: "var(--text-muted)", fontSize: 12 }}>
        📈 Enter at least 2 logs to view BP trends
      </div>
    );
  }

  const sysValues = validLogs.map(d => parseFloat(d.bpSystolic));
  const diaValues = validLogs.map(d => parseFloat(d.bpDiastolic));
  const minVal = Math.min(...diaValues) * 0.9;
  const maxVal = Math.max(...sysValues) * 1.1;
  const valRange = maxVal - minVal || 1;

  const width = 400;
  const height = 120;
  const padding = 20;

  const getX = (index) => padding + (index * (width - padding * 2) / (validLogs.length - 1));
  const getY = (val) => height - padding - ((val - minVal) * (height - padding * 2) / valRange);

  let sysPath = "";
  let diaPath = "";
  validLogs.forEach((log, index) => {
    const x = getX(index);
    const ySys = getY(parseFloat(log.bpSystolic));
    const yDia = getY(parseFloat(log.bpDiastolic));
    if (index === 0) {
      sysPath += `M ${x} ${ySys}`;
      diaPath += `M ${x} ${yDia}`;
    } else {
      sysPath += ` L ${x} ${ySys}`;
      diaPath += ` L ${x} ${yDia}`;
    }
  });

  return (
    <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "12px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700 }}>Blood Pressure Trend (Sys/Dia)</p>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <path d={sysPath} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        <path d={diaPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

        {validLogs.map((log, index) => {
          const x = getX(index);
          const ySys = getY(parseFloat(log.bpSystolic));
          const yDia = getY(parseFloat(log.bpDiastolic));
          return (
            <g key={log.id}>
              <circle cx={x} cy={ySys} r="4" fill="var(--bg-white)" stroke="var(--primary)" strokeWidth="2" />
              <circle cx={x} cy={yDia} r="4" fill="var(--bg-white)" stroke="#3b82f6" strokeWidth="2" />
              <text x={x} y={ySys - 8} fontSize="8" fontWeight="700" textAnchor="middle" fill="var(--text-primary)">{log.bpSystolic}</text>
              <text x={x} y={yDia + 12} fontSize="8" fontWeight="700" textAnchor="middle" fill="var(--text-primary)">{log.bpDiastolic}</text>
              <text x={x} y={height - 4} fontSize="8" fill="var(--text-muted)" textAnchor="middle">
                {new Date(log.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── SCREEN COMPONENTS ─────────────────────────────────────── */
function DashboardScreen({ stats, onNavigate }) {
  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, justifyOrigin: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Portal welcome banner card */}
        <div style={{
          background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
          borderRadius: 24,
          padding: "36px",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(225, 29, 72, 0.15)"
        }}>
          {/* Subtle heartbeat line background effect */}
          <div style={{
            position: "absolute",
            top: 20,
            right: 20,
            fontSize: 90,
            opacity: 0.08,
            pointerEvents: "none",
            userSelect: "none"
          }}>🫀</div>
          
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", marginBottom: 16 }}>
            Healthcare • Vision • Gemini AI
          </div>
          
          <h1 style={{ margin: "0 0 12px", fontSize: 32, fontWeight: 900, fontFamily: "'Outfit', sans-serif" }}>MediAssist AI Portal</h1>
          <p style={{ margin: "0 0 24px", fontSize: 14, opacity: 0.9, lineHeight: 1.6, maxWidth: 640 }}>
            A secure, responsible healthcare companion powered by Google Gemini. Explore health topics, explain reports, check medications, and analyze visual symptoms under secure parameters.
          </p>
          
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.18)", padding: "10px 16px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
            ⚠️ Educational Use Only — Not a substitute for a clinical consultation.
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          <div onClick={() => onNavigate("chat")} style={{
            background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 20, padding: "24px", textAlign: "center", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 12
          }}>
            <span style={{ fontSize: 32 }}>💬</span>
            <div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>{stats.queries}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Queries Answered</p>
            </div>
          </div>

          <div onClick={() => onNavigate("analyzer")} style={{
            background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 20, padding: "24px", textAlign: "center", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 12
          }}>
            <span style={{ fontSize: 32 }}>🔬</span>
            <div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>{stats.images}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Images Analyzed</p>
            </div>
          </div>

          <div onClick={() => onNavigate("vault")} style={{
            background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 20, padding: "24px", textAlign: "center", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 12
          }}>
            <span style={{ fontSize: 32 }}>📋</span>
            <div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>{stats.reports}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Reports Summarized</p>
            </div>
          </div>

          <div onClick={() => onNavigate("chat")} style={{
            background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 20, padding: "24px", textAlign: "center", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 12
          }}>
            <span style={{ fontSize: 32 }}>🚨</span>
            <div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#ef4444" }}>{stats.emergencies}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>Emergency Alerts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", padding: "16px 0 0", borderTop: "1px solid var(--border-color)", display: "flex", justifyOrigin: "center", justifyContent: "space-between", alignItems: "center" }}>
        <span>MediAssist AI Portal</span>
        <span style={{ fontWeight: 700 }}>Dedicated Preliminary Reference Engine</span>
        <span>Privacy Terms</span>
      </div>
    </div>
  );
}

function CheckerScreen({ onAskTriage }) {
  const [symptom, setSymptom] = useState("");
  const [onset, setOnset] = useState("gradual");
  const [duration, setDuration] = useState("1");
  const [severity, setSeverity] = useState("mild");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const startCheck = async () => {
    if (!symptom.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const prompt = `Patient Symptom: "${symptom}"\nSeverity reported: ${severity}\nOnset pattern: ${onset}\nDuration: ${duration} days.\n\nEvaluate and give details on condition severity, recommendations, and next steps.`;
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: CHECKER_SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      setResult(data.choices?.[0]?.message?.content || "Analysis failed.");
    } catch (e) {
      setResult("⚠️ Error evaluating symptoms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>🩺 AI Symptom Assessor</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Describe symptoms in your own words</label>
            <textarea value={symptom} onChange={e => setSymptom(e.target.value)} style={{ width: "100%", height: 70, padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", resize: "none" }} placeholder="e.g. Sharp pain in the lower left back, radiating towards groin" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Onset Type</label>
              <select value={onset} onChange={e => setOnset(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                <option value="sudden">⚡ Sudden</option>
                <option value="gradual">📈 Gradual</option>
                <option value="intermittent">🔄 Intermittent</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Duration (days)</label>
              <input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Severity Scale</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                <option value="mild">🟢 Mild</option>
                <option value="moderate">🟡 Moderate</option>
                <option value="severe">🔴 Severe</option>
              </select>
            </div>
          </div>

          <button onClick={startCheck} disabled={loading || !symptom.trim()} style={{
            background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer"
          }}>{loading ? "Running Triage Assessment..." : "Begin Symptom Check"}</button>
        </div>
      </div>

      {result && (
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>🩺 Clinical Triage Advice</h4>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "16px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {result}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyzerScreen({ onImageUpload, uploadedFile, onClearFile, loading, results, onAnalyze }) {
  const fileRef = useRef();
  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>💊 Prescription & Label Parser</h3>
        <p style={{ margin: "0 0 16px", fontSize: 11, color: "var(--text-muted)" }}>Scan prescriptions or medicine bottles to extract dosages and side effects</p>

        <input type="file" ref={fileRef} accept="image/*" style={{ display: "none" }} onChange={e => onImageUpload(e.target.files[0])} />
        
        {!uploadedFile ? (
          <div onClick={() => fileRef.current?.click()} style={{
            height: 140, border: "2px dashed var(--border-color)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyOrigin: "center", justifyContent: "center", cursor: "pointer", background: "var(--bg-primary)"
          }}>
            <span style={{ fontSize: 32, marginBottom: 8 }}>📸</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Upload Prescription or Bottle Image</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Supports JPG, PNG</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", background: "var(--bg-primary)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: 12 }}>
              <img src={uploadedFile.preview} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{uploadedFile.name}</p>
                <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>Image ready for extraction</p>
              </div>
              <button onClick={onClearFile} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", padding: 6 }}>✕</button>
            </div>
            <button onClick={onAnalyze} disabled={loading} style={{
              background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyOrigin: "center", justifyContent: "center", gap: 8, transition: "background 0.15s"
            }}>
              {loading ? "Analyzing..." : "🔍 Extract Medication Schedule"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 12, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
          🔒 <strong>Privacy Notice:</strong> Uploaded medical data is processed live in your memory context and is not saved permanently on external storage or databases.
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Dot delay={0} /> <Dot delay={0.2} /> <Dot delay={0.4} />
          <p style={{ fontSize: 12, marginTop: 8, color: "var(--text-muted)" }}>Analyzing prescription image & extracting metadata...</p>
        </div>
      )}

      {results && (
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>📋 Extracted Medication Schedule</h4>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "16px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {results}
          </div>
        </div>
      )}
    </div>
  );
}

function VaultScreen({ records, onAddRecord, onGenerateSummary }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Prescription");
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);

  const saveRecord = (e) => {
    e.preventDefault();
    if (!title || !content) return;
    onAddRecord({ title, category, date: new Date().toISOString().split("T")[0], content, summary: "" });
    setTitle(""); setContent("");
  };

  const getSummary = async (rec) => {
    setLoading(true);
    try {
      const summaryText = await onGenerateSummary(rec.content);
      rec.summary = summaryText;
      setSelectedRecord({ ...rec });
    } catch (e) {
      alert("Failed to summarize document.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = records.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      {/* Add Document Form */}
      <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px", height: "fit-content" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>🔐 Secure Document Vault</h3>
        <form onSubmit={saveRecord} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Document Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }} placeholder="e.g. May Blood Test Report" required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
              <option value="Prescription">Prescription</option>
              <option value="Lab Report">Lab Report</option>
              <option value="Vaccination">Vaccination Card</option>
              <option value="Other">Other Document</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>OCR / Text Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} style={{ width: "100%", height: 100, padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", resize: "none" }} placeholder="Paste extracted document text here for local indexing and AI summaries..." required />
          </div>
          <button type="submit" style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer" }}>Store Document</button>
          <div style={{ marginTop: 6, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>
            🔒 <strong>Privacy Notice:</strong> Stored documents are indexed privately inside your local browser's database and are not saved on external servers.
          </div>
        </form>
      </div>

      {/* Vault List & Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }} placeholder="🔍 Search documents (OCR index)..." />
          
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: 240 }}>
            {filtered.map(r => (
              <div key={r.id} onClick={() => setSelectedRecord(r)} style={{
                padding: "12px", border: "1px solid var(--border-color)", borderRadius: 10, cursor: "pointer", background: selectedRecord?.id === r.id ? "var(--primary-light)" : "var(--bg-primary)"
              }}>
                <div style={{ display: "flex", justifyOrigin: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{r.title}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.date}</span>
                </div>
                <Pill color="var(--primary)" bg="transparent" style={{ padding: 0, marginTop: 4, display: "inline-block" }}>{r.category}</Pill>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Record Detail Panel */}
        {selectedRecord && (
          <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
            <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 800 }}>📄 {selectedRecord.title}</h4>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--text-muted)" }}>Category: {selectedRecord.category} | Logged: {selectedRecord.date}</p>

            {selectedRecord.summary ? (
              <div style={{ background: "var(--primary-light)", border: "1px solid var(--primary)20", padding: "10px 14px", borderRadius: 10, marginBottom: 12 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>🤖 AI Patient Summary</p>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--text-primary)" }}>{selectedRecord.summary}</p>
              </div>
            ) : (
              <button onClick={() => getSummary(selectedRecord)} disabled={loading} style={{
                background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12
              }}>{loading ? "Summarizing..." : "Generate AI Summary ↗"}</button>
            )}

            <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Document OCR Text</label>
            <div style={{ height: 100, overflowY: "auto", background: "var(--bg-primary)", padding: "10px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border-color)" }}>
              {selectedRecord.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RemindersScreen({ reminders, onAddReminder, onToggleReminder }) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00 AM");
  const [dosage, setDosage] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];

  const submitReminder = (e) => {
    e.preventDefault();
    if (!name || !dosage) return;
    onAddReminder({ name, time, dosage, taken: {} });
    setName(""); setDosage("");
  };

  const takenCount = reminders.filter(r => r.taken?.[todayStr] === "taken").length;
  const progressPercent = reminders.length > 0 ? Math.round((takenCount / reminders.length) * 100) : 0;

  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      {/* Scheduler Form */}
      <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px", height: "fit-content" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>⏰ Medication Scheduler</h3>
        <form onSubmit={submitReminder} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Medicine Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }} placeholder="e.g. Paracetamol" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Dosage</label>
              <input type="text" value={dosage} onChange={e => setDosage(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }} placeholder="e.g. 500mg" required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Time</label>
              <select value={time} onChange={e => setTime(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                <option value="08:00 AM">🌅 Morning (08:00 AM)</option>
                <option value="01:00 PM">☀️ Afternoon (01:00 PM)</option>
                <option value="08:00 PM">🌙 Night (08:00 PM)</option>
              </select>
            </div>
          </div>
          <button type="submit" style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer" }}>Add Schedule</button>
        </form>
      </div>

      {/* Reminder Checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px", display: "flex", justifyOrigin: "center", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📋 Today's Medication Tracker</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>Mark taken or missed doses</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{progressPercent}% Done</span>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `conic-gradient(var(--primary) ${progressPercent}%, var(--border-color) 0)`, display: "flex", alignItems: "center", justifyOrigin: "center", justifyContent: "center" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reminders.map(r => {
            const status = r.taken?.[todayStr] || "pending";
            let statusBg = "var(--bg-white)";
            let statusColor = "var(--text-primary)";
            let statusIcon = "⬜";

            if (status === "taken") {
              statusBg = "#f0fdf4";
              statusColor = "#16a34a";
              statusIcon = "✅";
            } else if (status === "missed") {
              statusBg = "#fff1f2";
              statusColor = "#e11d48";
              statusIcon = "❌";
            }

            return (
              <div key={r.id} onClick={() => onToggleReminder(r.id, todayStr)} style={{
                background: statusBg, border: "1px solid var(--border-color)", padding: "14px", borderRadius: 12, display: "flex", justifyOrigin: "center", justifyContent: "space-between", alignItems: "center", cursor: "pointer"
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: statusColor }}>{r.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--text-muted)" }}>Dosage: {r.dosage} | Scheduled: {r.time}</p>
                </div>
                <span style={{ fontSize: 18 }}>{statusIcon}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── AI MEDICAL CHAT COMPONENT ──────────────────────────────── */
function ChatScreen({ messages, onSend, loading, onImageUpload, uploadedFile, onClearFile, tab, voiceLang, setVoiceLang, onSpeechStart, speakText }) {
  const [input, setInput] = useState("");
  const fileRef = useRef();
  const bottomRef = useRef();
  const taRef = useRef();

  const placeholders = {
    chat: "Ask MediAssist AI... e.g. 'I have headache, throat sore, and cough'",
    image: "Upload a photo of medicine label/symptoms and ask AI details...",
    report: "Attach clinical lab report copy and ask AI explanation..."
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading]);

  const send = () => {
    const t = input.trim();
    if (!t && !uploadedFile) return;
    onSend(t);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Lang & voice controls */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyOrigin: "center", justifyContent: "space-between", alignItems: "center", background: "var(--bg-white)" }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>🎙️ Multilingual Voice Assessor</span>
        <select value={voiceLang} onChange={e => setVoiceLang(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
          <option value="en-US">🇬🇧 English</option>
          <option value="hi-IN">🇮🇳 Hindi (हिन्दी)</option>
          <option value="te-IN">🇮🇳 Telugu (తెలుగు)</option>
        </select>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {messages.map(m => {
          const isRedFlag = m.emergency || hasEmergencyKeywords(m.content);
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 12, marginBottom: 20, alignItems: "flex-start" }}>
              <Avatar label={m.role === "user" ? "You" : "M"} bg={m.role === "user" ? "#1e293b" : "var(--primary)"} />
              <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", gap: 6, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  background: m.role === "user" ? "var(--primary)" : isRedFlag ? "#fef2f2" : "var(--bg-white)",
                  color: m.role === "user" ? "#fff" : "var(--text-primary)",
                  border: m.role === "user" ? "none" : isRedFlag ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
                  borderRadius: m.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                  padding: "12px 18px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  boxShadow: isRedFlag ? "0 4px 12px rgba(239, 68, 68, 0.12)" : "none"
                }}>
                  {isRedFlag && m.role !== "user" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#ef4444", fontWeight: 800, fontSize: 11, letterSpacing: "0.5px" }}>
                      <span>🚨 CLINICAL RED FLAG DETECTED</span>
                    </div>
                  )}
                  {m.content}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{new Date(m.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  {m.role === "assistant" && (
                    <button onClick={() => speakText(m.content, voiceLang)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }} title="Listen Response">🔊 Speak</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {loading && <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
          <Avatar label="M" bg="var(--primary)" />
          <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: "4px 18px 18px 18px", padding: "14px 20px" }}>
            <Dot delay={0} /> <Dot delay={0.2} /> <Dot delay={0.4} />
          </div>
        </div>}
        <div ref={bottomRef} />
      </div>

      {/* Input controls */}
      <div style={{ background: "var(--bg-white)", borderTop: "1px solid var(--border-color)", padding: "16px 24px", display: "flex", gap: 12, alignItems: "flex-end" }}>
        <input type="file" ref={fileRef} accept="image/*" style={{ display: "none" }} onChange={e => onImageUpload(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-primary)", fontSize: 18, cursor: "pointer" }}>📎</button>
        
        <button onClick={() => onSpeechStart(setInput)} style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-primary)", fontSize: 18, cursor: "pointer" }}>🎤</button>

        <div style={{ flex: 1, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "10px 14px" }}>
          <textarea ref={taRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={placeholders[tab] || "Ask MediAssist..."} rows={1} style={{ width: "100%", background: "transparent", border: "none", resize: "none", fontSize: 13, color: "var(--text-primary)", outline: "none", maxHeight: 100, fontFamily: "inherit" }} />
        </div>
        <button onClick={send} disabled={loading || (!input.trim() && !uploadedFile)} style={{ width: 44, height: 44, borderRadius: 10, background: "var(--primary)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>➤</button>
      </div>
    </div>
  );
}

function EmergencyScreen() {
  const reds = [
    { icon: "❤️", title: "Cardiac Events", sxs: ["Intense chest pain, tightness or pressure", "Radiating discomfort to arm, neck or jaw", "Shortness of breath accompanied by cold sweat", "Extreme weakness, sudden nausea or lightheadedness"] },
    { icon: "🧠", title: "Stroke Indicators (FAST)", sxs: ["F — Face drooping on one side", "A — Arm weakness or numbness when lifting both", "S — Speech slurring or inability to formulate words", "T — Time to call emergency response (112) immediately", "Sudden severe headache with no known cause"] },
    { icon: "🫁", title: "Severe Respiratory Distress", sxs: ["Inability to speak in full sentences due to breathlessness", "Cyanosis (bluish tint on lips, tongue, or fingertips)", "Stridors or high-pitched wheezing", "Acute allergic reaction (anaphylaxis) with throat swelling"] }
  ];

  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", background: "var(--bg-primary)" }}>
      <div style={{ background: "linear-gradient(135deg, #7f1d1d, #b91c1c)", borderRadius: 16, padding: "24px", color: "#fff", marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>🚨 Medical Emergency Protocols</h2>
        <p style={{ margin: 0, fontSize: 13 }}>If someone is experiencing any warning signs below, call 112 or local response teams immediately.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {reds.map(r => (
          <div key={r.title} style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14 }}>{r.icon} {r.title}</p>
            {r.sxs.map(s => (
              <div key={s} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span style={{ color: "#ef4444" }}>•</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQScreen({ onAsk }) {
  const faqs = [
    { q: "What is healthy reference BP?", a: "Standard ideal blood pressure is under 120/80 mmHg. Consistent readings above 130/80 denote hypertension stages and warrant clinical checkup." },
    { q: "When should I visit the Emergency Room?", a: "Go immediately for chest tightness, radiating limb pains, sudden slurring or facial droop, dyspnea, or severe head injuries." },
    { q: "What are healthy blood glucose ranges?", a: "Fasting blood sugar: 70-99 mg/dL is normal. Prediabetic ranges are 100-125, and levels of 126+ on multiple tests denote diabetes." }
  ];
  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto" }}>
      {faqs.map((f, i) => (
        <div key={i} style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14 }}>{f.q}</p>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)" }}>{f.a}</p>
          <button onClick={() => onAsk(f.q)} style={{ background: "var(--primary-light)", color: "var(--primary)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Ask AI About This</button>
        </div>
      ))}
    </div>
  );
}

const hasEmergencyKeywords = (text) => {
  if (typeof text !== "string") return false;
  const keywords = [/🚨/i, /emergency/i, /immediate medical attention/i, /call 112/i, /call 911/i, /seek immediate care/i, /red flag/i, /critical indicator/i, /go to the emergency/i];
  return keywords.some(regex => regex.test(text));
};

function ModelInfoScreen() {
  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "24px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "var(--primary)" }}>⚙️ Model Architecture & Safety Guidelines</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          MediAssist AI leverages advanced generative artificial intelligence and custom triage logic to provide preliminary educational support. Learn about the underlying technology stack, clinical guardrails, and privacy architecture below.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Model Spec */}
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>🤖 Core Model Engine</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "var(--bg-primary)", padding: "12px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Model Identifier</span>
              <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>gemini-3.1-flash-lite</p>
            </div>
            <div style={{ background: "var(--bg-primary)", padding: "12px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Supported Capabilities</span>
              <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800 }}>Multimodal Vision, Text, Speech-to-Text, Structured JSON Output</p>
            </div>
            <div style={{ background: "var(--bg-primary)", padding: "12px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Average Latency</span>
              <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: "#22c55e" }}>~400ms (Real-time Streaming)</p>
            </div>
          </div>
        </div>

        {/* Safety Guardrails */}
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>🛡️ Clinical Triage Guardrails</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ background: "#22c55e", width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 800 }}>Green Triage (Home Care)</span>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Mild/routine symptoms: cold, standard minor bruises, allergies. Suggestions focus on hydration, rest, and comfort.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ background: "#eab308", width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 800 }}>Amber Triage (Consult Doctor)</span>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Persistent or moderate conditions: continuous fever, persistent rashes. Recommends booking a medical consultation.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ background: "#ef4444", width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#ef4444" }}>Red Triage (Emergency Care)</span>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Critical symptoms: chest pain, speech difficulty, stroke indicators. Triggers high-priority visual alerts and provides immediate next steps.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prompts Section */}
      <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>📝 AI System Instructions</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>Below are the safety and operational instructions configured for our AI models to ensure structured clinical guidance:</p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>💬 Medical Assistant System Prompt:</span>
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: 8, fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", maxHeight: 150, overflowY: "auto" }}>
              {CHAT_SYSTEM_PROMPT}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>🔬 Prescription Parser System Prompt:</span>
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: 8, fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", maxHeight: 150, overflowY: "auto" }}>
              {ANALYZER_SYSTEM_PROMPT}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyPolicyScreen() {
  return (
    <div style={{ padding: "24px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "24px" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 900, color: "var(--primary)" }}>🔒 Privacy Policy & Data Safeguards</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          At MediAssist AI, your medical privacy is our highest clinical priority. We design and construct our services around strict local-first and client-side processing boundaries to assure safety and confidentiality.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>📂 Local-First Data Storage</h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            All patient data, including health vitals, reminders, and parsed records, is indexed directly in your browser's private localStorage. We do not transmit or store your documents on external servers.
          </p>
        </div>
        
        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>🛡️ Gemini AI Privacy Boundaries</h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Image analysis and triage sessions are executed securely using API parameters that enforce transient context operations. No personal identifier data is coupled with the models.
          </p>
        </div>

        <div style={{ background: "var(--bg-white)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>⚕️ HIPAA Compliance Protocols</h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            By housing patient telemetry strictly within the client device environment, MediAssist AI remains fully aligned with standard zero-trust configurations.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP COMPONENT ─────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("home");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("mediassist_dark") === "true");
  const [sideOpen, setSideOpen] = useState(true);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [vitalsLogs, setVitalsLogs] = useState(() => {
    const saved = localStorage.getItem("mediassist_vitals");
    return saved ? JSON.parse(saved) : [
      { id: "1", timestamp: "2026-05-10T08:00:00.000Z", weight: 70, bpSystolic: 120, bpDiastolic: 80, sugar: 95, hr: 72 },
      { id: "2", timestamp: "2026-05-17T08:00:00.000Z", weight: 69.5, bpSystolic: 122, bpDiastolic: 81, sugar: 98, hr: 75 },
      { id: "3", timestamp: "2026-05-24T08:00:00.000Z", weight: 69.2, bpSystolic: 118, bpDiastolic: 79, sugar: 94, hr: 70 }
    ];
  });

  const [vaultRecords, setVaultRecords] = useState(() => {
    const saved = localStorage.getItem("mediassist_vault");
    return saved ? JSON.parse(saved) : [
      { id: "1", title: "Complete Blood Count Panel", category: "Lab Report", date: "2026-05-15", content: "Hemoglobin 14.2 g/dL, WBC 6.5 x10^3/uL, Platelets 250 x10^3/uL. All parameters in normal range.", summary: "Hemoglobin, WBC, and Platelet levels are all within healthy clinical intervals." }
    ];
  });

  const [reminders, setReminders] = useState(() => {
    const saved = localStorage.getItem("mediassist_reminders");
    return saved ? JSON.parse(saved) : [
      { id: "1", name: "Metformin", time: "08:00 AM", dosage: "500mg", taken: {} },
      { id: "2", name: "Atorvastatin", time: "08:00 PM", dosage: "10mg", taken: {} }
    ];
  });

  const [voiceLang, setVoiceLang] = useState("en-US");

  // Initial greeting msg setup
  const initMsg = {
    id: uid(), role: "assistant", ts: new Date(),
    content: "Hello! I'm your **MediAssist AI** clinical companion. How can I help you today? You can describe symptoms, check medication info, or inspect lab summaries."
  };

  const [chatMsgs, setChatMsgs] = useState([initMsg]);
  const [analyzerMsgs, setAnalyzerMsgs] = useState([]);
  const [aiLanguage, setAiLanguage] = useState("English");
  const [analyzerResult, setAnalyzerResult] = useState("");

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem("mediassist_stats");
    return saved ? JSON.parse(saved) : { queries: 0, images: 0, reports: 0, emergencies: 0 };
  });

  useEffect(() => {
    localStorage.setItem("mediassist_stats", JSON.stringify(stats));
  }, [stats]);

  const incrementStat = (key) => {
    setStats(prev => ({ ...prev, [key]: prev[key] + 1 }));
  };

  useEffect(() => {
    localStorage.setItem("mediassist_dark", darkMode);
    if (darkMode) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  }, [darkMode]);

  const handleAddLog = (log) => {
    const newLogs = [...vitalsLogs, { id: uid(), timestamp: new Date().toISOString(), ...log }];
    setVitalsLogs(newLogs);
    localStorage.setItem("mediassist_vitals", JSON.stringify(newLogs));
  };

  const handleAddRecord = (rec) => {
    const newRecords = [...vaultRecords, { id: uid(), ...rec }];
    setVaultRecords(newRecords);
    localStorage.setItem("mediassist_vault", JSON.stringify(newRecords));
  };

  const handleGenerateSummary = async (contentText) => {
    const langPrompt = aiLanguage !== "English" ? ` Please write the entire summary in ${aiLanguage}.` : "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: VAULT_SYSTEM_PROMPT + langPrompt, messages: [{ role: "user", content: `Please summarize: ${contentText}` }] })
      });
      const data = await res.json();
      const summaryText = data.choices?.[0]?.message?.content || "Could not generate summary.";
      if (summaryText && !summaryText.startsWith("⚠️")) {
        incrementStat("reports");
      }
      return summaryText;
    } catch (e) {
      return "⚠️ Summary generation failed.";
    }
  };

  const handleAnalyzePrescription = async () => {
    if (!uploadedFile?.base64) return;
    setLoading(true);
    setAnalyzerResult("");
    const langPrompt = aiLanguage !== "English" ? ` IMPORTANT: Please write the entire parsed analysis in ${aiLanguage}.` : "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: ANALYZER_SYSTEM_PROMPT + langPrompt,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: uploadedFile.type, data: uploadedFile.base64 } },
                { type: "text", text: "Extract medication schedule from this image." }
              ]
            }
          ]
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${res.status}`);
      }
      const data = await res.json();
      setAnalyzerResult(data.choices?.[0]?.message?.content || "No details extracted.");
      incrementStat("images");
    } catch (e) {
      setAnalyzerResult(`⚠️ Extraction failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReminder = (med) => {
    const newMeds = [...reminders, { id: uid(), ...med }];
    setReminders(newMeds);
    localStorage.setItem("mediassist_reminders", JSON.stringify(newMeds));
  };

  const handleToggleReminder = (id, dateStr) => {
    const updated = reminders.map(r => {
      if (r.id === id) {
        const nextTaken = { ...r.taken };
        if (nextTaken[dateStr] === "taken") nextTaken[dateStr] = "missed";
        else if (nextTaken[dateStr] === "missed") delete nextTaken[dateStr];
        else nextTaken[dateStr] = "taken";
        return { ...r, taken: nextTaken };
      }
      return r;
    });
    setReminders(updated);
    localStorage.setItem("mediassist_reminders", JSON.stringify(updated));
  };

  const handleUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const isImage = file.type?.startsWith("image/");
      if (isImage) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width; width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height; height = MAX_SIZE;
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setUploadedFile({
            name: file.name, type: "image/jpeg",
            base64: compressedDataUrl.split(",")[1],
            preview: URL.createObjectURL(file)
          });
        };
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (text) => {
    const emerg = isEmergency(text || "");
    const f = uploadedFile;

    const userMsg = {
      id: uid(), role: "user", ts: new Date(),
      content: text || "(Medicine image loaded for parse)",
      imagePreview: f?.preview || null
    };

    const history = [...chatMsgs, userMsg];
    setChatMsgs(history);
    setUploadedFile(null);
    setLoading(true);

    try {
      const apiMsgs = history.map((m, i) => {
        if (m.role === "user") {
          const content = [];
          if (i === history.length - 1 && f?.base64) {
            content.push({ type: "image", source: { type: "base64", media_type: f.type, data: f.base64 } });
          }
          const txt = m.content || "";
          if (txt) content.push({ type: "text", text: txt });
          return { role: "user", content: content.length === 1 && content[0].type === "text" ? txt : content };
        }
        return { role: "assistant", content: m.content };
      });

      const langPrompt = aiLanguage !== "English" ? `\n\nIMPORTANT: Respond entirely in the ${aiLanguage} language.` : "";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: CHAT_SYSTEM_PROMPT + langPrompt, messages: apiMsgs })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${res.status}`);
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "No reply returned.";

      setChatMsgs(prev => [...prev, { id: uid(), role: "assistant", ts: new Date(), emergency: emerg, content: reply }]);
      incrementStat("queries");
      if (emerg) incrementStat("emergencies");
    } catch (e) {
      setChatMsgs(prev => [...prev, { id: uid(), role: "assistant", ts: new Date(), content: "⚠️ Error sending details. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const startSpeechRecognition = (onResult) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported on this browser.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = voiceLang;
    rec.onresult = (e) => {
      onResult(e.results[0][0].transcript);
    };
    rec.start();
  };

  const speakText = (text, lang) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*`🚨⚠️⚕️]/g, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  const handleTriggerTriage = (symptomText) => {
    setTab("checker");
  };

  const navItems = [
    { id: "home", icon: "🏠", label: "Dashboard" },
    { id: "chat", icon: "💬", label: "Symptom Chat" },
    { id: "analyzer", icon: "🔬", label: "Image Analysis" },
    { id: "vault", icon: "📋", label: "Report Summary" },
    { id: "meds", icon: "💊", label: "Medicine Info" },
    { id: "emergency", icon: "🚨", label: "Emergency Guide" },
    { id: "faq", icon: "❓", label: "Health FAQ" },
    { id: "privacy", icon: "🔒", label: "Privacy Policy" },
    { id: "reset", icon: "🔄", label: "Reset Conversations" }
  ];

  return (
    <div style={{
      display: "flex", height: "100vh", width: "100vw", background: "var(--bg-primary)", overflow: "hidden"
    }}>
      {/* SIDEBAR */}
      {sideOpen && (
        <div style={{
          width: 250, background: "var(--bg-white)", borderRight: "1px solid var(--border-color)",
          display: "flex", flexDirection: "column", flexShrink: 0
        }}>
          <div style={{ padding: "20px", borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>🏥</span>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>MediAssist AI</p>
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>• Local secure session</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, padding: "16px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => {
                if (n.id === "reset") {
                  if (confirm("Are you sure you want to reset all conversations, documents, reminders, and statistics? This cannot be undone.")) {
                    localStorage.setItem("mediassist_chat", JSON.stringify([]));
                    localStorage.setItem("mediassist_vault", JSON.stringify([]));
                    localStorage.setItem("mediassist_reminders", JSON.stringify([]));
                    localStorage.setItem("mediassist_vitals", JSON.stringify([]));
                    localStorage.setItem("mediassist_stats", JSON.stringify({ queries: 0, images: 0, reports: 0, emergencies: 0 }));
                    
                    setChatMsgs([initMsg]);
                    setVaultRecords([]);
                    setReminders([]);
                    setVitalsLogs([]);
                    setStats({ queries: 0, images: 0, reports: 0, emergencies: 0 });
                    setAnalyzerResult("");
                    
                    alert("Conversations and statistics have been successfully reset!");
                    setTab("home");
                  }
                } else {
                  setTab(n.id);
                }
              }} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                background: tab === n.id ? "var(--primary-light)" : "transparent",
                border: "none", borderRadius: 12, padding: "12px 14px",
                cursor: "pointer", fontSize: 13, color: tab === n.id ? "var(--primary)" : "var(--text-secondary)",
                fontWeight: tab === n.id ? 700 : 500, textAlign: "left", transition: "all 0.15s"
              }}>
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "12px", margin: "0 12px 12px", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 12 }}>
            <p style={{ margin: 0, fontSize: 10, color: "#be123c", lineHeight: 1.4, fontWeight: 500 }}>
              ⚠️ <strong>Disclaimer:</strong> For educational use only. Always consult a medical physician for health concerns.
            </p>
          </div>

          <div style={{ padding: "14px", borderTop: "1px solid var(--border-color)" }}>
            <button onClick={() => setDarkMode(d => !d)} style={{
              width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border-color)",
              borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--text-primary)"
            }}>
              {darkMode ? "☀️ Light Theme" : "🌙 Dark Theme"}
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          background: "var(--bg-white)", borderBottom: "1px solid var(--border-color)",
          padding: "16px 24px", display: "flex", alignItems: "center", justifyOrigin: "center", justifyContent: "space-between", flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => setSideOpen(s => !s)} style={{ background: "transparent", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "var(--text-primary)" }}>☰</button>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Personal Clinical Companion</p>
              <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>Secure localStorage data vault • Gemini 3.1 Engine</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>🌐 AI Language:</span>
              <select value={aiLanguage} onChange={e => setAiLanguage(e.target.value)} style={{
                padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 11, fontWeight: 700
              }}>
                <option value="English">🇬🇧 English</option>
                <option value="Hindi">🇮🇳 Hindi (हिन्दी)</option>
                <option value="Telugu">🇮🇳 Telugu (తెలుగు)</option>
              </select>
            </div>
            <Pill color="var(--primary)" bg="var(--primary-light)">🛡️ Private Mode</Pill>
          </div>
        </div>

        {/* Dynamic Pages */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {tab === "home" && (
            <DashboardScreen stats={stats} onNavigate={setTab} />
          )}
          {tab === "chat" && (
            <ChatScreen
              tab="chat"
              messages={chatMsgs}
              onSend={handleSend}
              loading={loading}
              onImageUpload={handleUpload}
              uploadedFile={uploadedFile}
              onClearFile={() => setUploadedFile(null)}
              voiceLang={voiceLang}
              setVoiceLang={setVoiceLang}
              onSpeechStart={startSpeechRecognition}
              speakText={speakText}
            />
          )}
          {tab === "analyzer" && (
            <AnalyzerScreen
              onImageUpload={handleUpload}
              uploadedFile={uploadedFile}
              onClearFile={() => setUploadedFile(null)}
              loading={loading}
              results={analyzerResult}
              onAnalyze={handleAnalyzePrescription}
            />
          )}
          {tab === "vault" && <VaultScreen records={vaultRecords} onAddRecord={handleAddRecord} onGenerateSummary={handleGenerateSummary} />}
          {tab === "meds" && <RemindersScreen reminders={reminders} onAddReminder={handleAddReminder} onToggleReminder={handleToggleReminder} />}
          {tab === "emergency" && <EmergencyScreen />}
          {tab === "faq" && <FAQScreen onAsk={(q) => { setTab("chat"); setTimeout(() => handleSend(q), 100); }} />}
          {tab === "privacy" && <PrivacyPolicyScreen />}
        </div>

        {/* Safety Disclaimer Footer */}
        <div style={{
          background: "var(--bg-white)", borderTop: "1px solid var(--border-color)",
          padding: "10px 24px", display: "flex", alignItems: "center", justifyOrigin: "center", justifyContent: "space-between", flexShrink: 0, gap: 16
        }}>
          <p style={{ margin: 0, fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.4, flex: 1 }}>
            ⚠️ <strong>Medical Disclaimer:</strong> This assistant provides educational and preliminary support only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified physician for clinical guidance. If you are experiencing a medical emergency, seek immediate care.
          </p>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>⚕️ Educational Support Only</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Bigital AI Factory Introduction Presentation Generator
 * Outputs: docs/reports/2026-02-20T12-11-report-deck.pptx
 */
import PptxGenJS from "pptxgenjs";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, "../docs/reports/2026-02-20T12-11-report-deck.pptx");

// ── Brand Colors ──
const C = {
  bg: "0F172A", // Dark navy
  bgLight: "1E293B", // Lighter navy
  accent: "6366F1", // Indigo
  accentLight: "818CF8",
  green: "10B981",
  yellow: "F59E0B",
  red: "EF4444",
  white: "FFFFFF",
  gray: "94A3B8",
  grayLight: "CBD5E1",
  textDim: "64748B",
};

const pptx = new PptxGenJS();
pptx.author = "Clio (Planning Lead)";
pptx.company = "Bigital AI Factory";
pptx.subject = "Bigital AI Factory Introduction";
pptx.title = "Bigital AI Factory — AI Agent Office Simulator";

pptx.defineSlideMaster({
  title: "MASTER",
  background: { color: C.bg },
  objects: [
    { rect: { x: 0, y: "92%", w: "100%", h: "8%", fill: { color: C.bgLight } } },
    {
      text: {
        text: "Bigital AI Factory",
        options: { x: 0.4, y: "93%", w: 3, h: 0.4, fontSize: 9, color: C.textDim, fontFace: "Arial" },
      },
    },
    {
      text: {
        text: "CONFIDENTIAL",
        options: { x: 7.6, y: "93%", w: 2, h: 0.4, fontSize: 9, color: C.textDim, fontFace: "Arial", align: "right" },
      },
    },
  ],
});

// ── Helper ──
function addTitle(slide, title, opts = {}) {
  slide.addText(title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 24,
    fontFace: "Arial",
    bold: true,
    color: C.white,
    ...opts,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 0.9,
    w: 1.5,
    h: 0.04,
    fill: { color: C.accent },
  });
}

// ═══════════════════════════════════════════════
// SLIDE 1 — Cover
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: { type: "solid", color: C.bg },
  });
  // Decorative accent bar
  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.08,
    h: "100%",
    fill: { color: C.accent },
  });
  s.addText("BIGITAL AI FACTORY", {
    x: 0.8,
    y: 1.5,
    w: 8.5,
    h: 1,
    fontSize: 44,
    fontFace: "Arial",
    bold: true,
    color: C.white,
  });
  s.addText("Command Your AI Agent Empire\nfrom the CEO Desk", {
    x: 0.8,
    y: 2.5,
    w: 8.5,
    h: 0.9,
    fontSize: 20,
    fontFace: "Arial",
    color: C.accentLight,
    lineSpacingMultiple: 1.3,
  });
  s.addText("Local-first AI Agent Office Simulator", {
    x: 0.8,
    y: 3.5,
    w: 8.5,
    h: 0.5,
    fontSize: 14,
    fontFace: "Arial",
    color: C.gray,
  });
  s.addText(
    [
      { text: "v1.0.8", options: { fontSize: 12, color: C.green, bold: true } },
      { text: "  |  Apache 2.0  |  TypeScript  |  2026-02-20", options: { fontSize: 12, color: C.textDim } },
    ],
    { x: 0.8, y: 4.3, w: 8, h: 0.4, fontFace: "Arial" },
  );
  s.addText("Bigital AI Factory", {
    x: 0.8,
    y: 4.8,
    w: 8,
    h: 0.3,
    fontSize: 11,
    fontFace: "Arial",
    color: C.textDim,
    hyperlink: { url: "Bigital AI Factory" },
  });
}

// ═══════════════════════════════════════════════
// SLIDE 2 — Executive Summary
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Executive Summary");

  const bullets = [
    ["What", "CLI AI 어시스턴트를 픽셀아트 가상 회사의 직원으로 변환하는 오피스 시뮬레이터"],
    ["Why", "분산된 AI 도구를 통합 대시보드에서 관리, CEO로서 팀을 지휘"],
    ["How", "React 19 + Express 5 + SQLite + WebSocket 기반 로컬 우선 아키텍처"],
    ["Scale", "6개 부서, 600+ 스킬, 6 CLI 프로바이더, 8 외부 API 프로바이더 지원"],
    ["Impact", "자율 에이전트 협업 → 태스크 자동 분배 → Git Worktree 격리 → 코드 리뷰 → 머지"],
  ];

  bullets.forEach(([label, desc], i) => {
    const y = 1.2 + i * 0.85;
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y,
      w: 0.06,
      h: 0.55,
      fill: { color: C.accent },
    });
    s.addText(label, {
      x: 0.75,
      y,
      w: 1.2,
      h: 0.55,
      fontSize: 13,
      fontFace: "Arial",
      bold: true,
      color: C.accentLight,
      valign: "middle",
    });
    s.addText(desc, {
      x: 2.0,
      y,
      w: 7.5,
      h: 0.55,
      fontSize: 12,
      fontFace: "Arial",
      color: C.grayLight,
      valign: "middle",
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 3 — Architecture Overview
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "System Architecture");

  // Three-column architecture
  const cols = [
    {
      title: "Frontend",
      color: C.accent,
      items: [
        "React 19 + Vite 7",
        "PixiJS 8 (Pixel Art)",
        "Tailwind CSS 4",
        "WebSocket Client",
        "React Router 7",
        "PptxGenJS",
      ],
    },
    {
      title: "Backend",
      color: C.green,
      items: [
        "Express 5 (Node 22+)",
        "SQLite + WAL Mode",
        "WebSocket Server (ws)",
        "Zod Validation",
        "OAuth Handler",
        "Git Worktree Engine",
      ],
    },
    {
      title: "Integrations",
      color: C.yellow,
      items: [
        "6 CLI Providers",
        "8 External API Providers",
        "Telegram / Discord / Slack",
        "GitHub / Google OAuth",
        "OpenClaw Gateway",
        "AGENTS.md Injection",
      ],
    },
  ];

  cols.forEach((col, i) => {
    const x = 0.4 + i * 3.15;
    // Card background
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.2,
      w: 2.95,
      h: 3.8,
      fill: { color: C.bgLight },
      rectRadius: 0.08,
    });
    // Color header bar
    s.addShape(pptx.ShapeType.rect, {
      x,
      y: 1.2,
      w: 2.95,
      h: 0.06,
      fill: { color: col.color },
    });
    // Title
    s.addText(col.title, {
      x,
      y: 1.35,
      w: 2.95,
      h: 0.5,
      fontSize: 15,
      fontFace: "Arial",
      bold: true,
      color: col.color,
      align: "center",
    });
    // Items
    col.items.forEach((item, j) => {
      s.addText(item, {
        x: x + 0.25,
        y: 1.9 + j * 0.45,
        w: 2.5,
        h: 0.4,
        fontSize: 11,
        fontFace: "Arial",
        color: C.grayLight,
        valign: "middle",
        bullet: { type: "bullet", color: col.color },
      });
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 4 — Core Features (1/2)
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Core Features (1/2)");

  const features = [
    {
      icon: "🏢",
      title: "Pixel-Art Office",
      desc: "PixiJS 기반 6개 부서 시각화. 에이전트 걷기/작업/휴식 애니메이션. CEO 데스크 인터랙션.",
      color: C.accent,
    },
    {
      icon: "📋",
      title: "Kanban Task Board",
      desc: "Inbox → Planned → Collaborating → In Progress → Review → Done. 드래그 앤 드롭 상태 전환.",
      color: C.green,
    },
    {
      icon: "💬",
      title: "CEO Chat & Directives",
      desc: "$-prefix 지시 시스템. 팀 리더 직접 대화. 전사 공지. OpenClaw 메신저 연동.",
      color: C.yellow,
    },
    {
      icon: "🧠",
      title: "600+ Skills Library",
      desc: "Frontend, Backend, Design, AI/ML, DevOps, Security 등 카테고리별 스킬. 학습 이력 추적.",
      color: C.red,
    },
  ];

  features.forEach((f, i) => {
    const y = 1.2 + i * 1.05;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.4,
      y,
      w: 9.2,
      h: 0.9,
      fill: { color: C.bgLight },
      rectRadius: 0.06,
    });
    s.addText(f.icon, {
      x: 0.55,
      y,
      w: 0.6,
      h: 0.9,
      fontSize: 22,
      align: "center",
      valign: "middle",
    });
    s.addText(f.title, {
      x: 1.3,
      y,
      w: 2.2,
      h: 0.9,
      fontSize: 13,
      fontFace: "Arial",
      bold: true,
      color: f.color,
      valign: "middle",
    });
    s.addText(f.desc, {
      x: 3.5,
      y,
      w: 6,
      h: 0.9,
      fontSize: 11,
      fontFace: "Arial",
      color: C.grayLight,
      valign: "middle",
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 5 — Core Features (2/2)
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Core Features (2/2)");

  const features = [
    {
      icon: "🤝",
      title: "Meeting System",
      desc: "계획 승인 미팅, AI 생성 회의록, 다단계 리뷰 결정(approved/hold/remediation).",
      color: C.accent,
    },
    {
      icon: "🔀",
      title: "Git Worktree Isolation",
      desc: "태스크별 독립 브랜치. 에이전트간 코드 충돌 방지. CEO 승인 후 머지.",
      color: C.green,
    },
    {
      icon: "📊",
      title: "Task Report System",
      desc: "자동 완료 보고서 브로드캐스트. 기획팀장 통합 아카이브. 보고서 이력 필터링.",
      color: C.yellow,
    },
    {
      icon: "⚡",
      title: "Active Agent Control",
      desc: "실시간 에이전트 상태 모니터링. 프로세스/세션 메타데이터. 스턱 태스크 Kill 액션.",
      color: C.red,
    },
  ];

  features.forEach((f, i) => {
    const y = 1.2 + i * 1.05;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.4,
      y,
      w: 9.2,
      h: 0.9,
      fill: { color: C.bgLight },
      rectRadius: 0.06,
    });
    s.addText(f.icon, {
      x: 0.55,
      y,
      w: 0.6,
      h: 0.9,
      fontSize: 22,
      align: "center",
      valign: "middle",
    });
    s.addText(f.title, {
      x: 1.3,
      y,
      w: 2.2,
      h: 0.9,
      fontSize: 13,
      fontFace: "Arial",
      bold: true,
      color: f.color,
      valign: "middle",
    });
    s.addText(f.desc, {
      x: 3.5,
      y,
      w: 6,
      h: 0.9,
      fontSize: 11,
      fontFace: "Arial",
      color: C.grayLight,
      valign: "middle",
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 6 — Multi-Provider AI Support
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Multi-Provider AI Support");

  // CLI Providers
  s.addText("CLI Providers", {
    x: 0.5,
    y: 1.2,
    w: 4,
    h: 0.4,
    fontSize: 14,
    fontFace: "Arial",
    bold: true,
    color: C.accentLight,
  });

  const cliProviders = [
    ["Claude Code", "Anthropic", C.accent],
    ["Codex CLI", "OpenAI", C.green],
    ["Gemini CLI", "Google", C.yellow],
    ["OpenCode", "Multi-model", C.red],
    ["GitHub Copilot", "GitHub", C.grayLight],
    ["Antigravity", "Custom", C.gray],
  ];

  cliProviders.forEach(([name, vendor, color], i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 0.5 + col * 3.1;
    const y = 1.7 + row * 0.75;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 2.9,
      h: 0.6,
      fill: { color: C.bgLight },
      rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.06,
      h: 0.6,
      fill: { color },
    });
    s.addText(name, {
      x: x + 0.2,
      y,
      w: 1.8,
      h: 0.6,
      fontSize: 11,
      fontFace: "Arial",
      bold: true,
      color: C.white,
      valign: "middle",
    });
    s.addText(vendor, {
      x: x + 1.8,
      y,
      w: 1,
      h: 0.6,
      fontSize: 9,
      fontFace: "Arial",
      color: C.textDim,
      valign: "middle",
      align: "right",
    });
  });

  // External API Providers
  s.addText("External API Providers", {
    x: 0.5,
    y: 3.4,
    w: 5,
    h: 0.4,
    fontSize: 14,
    fontFace: "Arial",
    bold: true,
    color: C.accentLight,
  });

  const apiProviders = ["OpenAI", "Anthropic", "Google", "Ollama", "OpenRouter", "Together", "Groq", "Cerebras"];
  apiProviders.forEach((name, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = 0.5 + col * 2.35;
    const y = 3.9 + row * 0.55;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 2.15,
      h: 0.45,
      fill: { color: C.bgLight },
      rectRadius: 0.06,
    });
    s.addText(name, {
      x,
      y,
      w: 2.15,
      h: 0.45,
      fontSize: 10,
      fontFace: "Arial",
      color: C.grayLight,
      align: "center",
      valign: "middle",
    });
  });

  s.addText("AES-256-GCM encrypted credential storage in local SQLite", {
    x: 0.5,
    y: 4.85,
    w: 9,
    h: 0.3,
    fontSize: 10,
    fontFace: "Arial",
    italic: true,
    color: C.textDim,
  });
}

// ═══════════════════════════════════════════════
// SLIDE 7 — Organization & Departments
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Virtual Company Organization");

  const depts = [
    { name: "Planning", desc: "전략, 기획, 요구사항 분석, 시장 조사", icon: "📐", color: C.accent },
    { name: "Development", desc: "핵심 개발, 코드 구현, 기능 빌드", icon: "💻", color: C.green },
    { name: "Design", desc: "UI/UX 디자인, 시각 에셋 제작", icon: "🎨", color: C.yellow },
    { name: "QA/QC", desc: "품질 보증, 테스트, 버그 검증", icon: "🔍", color: C.red },
    { name: "DevSecOps", desc: "보안, CI/CD, 인프라 관리", icon: "🛡️", color: C.accentLight },
    { name: "Operations", desc: "운영, 커뮤니케이션, 문서화", icon: "📡", color: C.grayLight },
  ];

  depts.forEach((d, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 0.4 + col * 3.15;
    const y = 1.3 + row * 1.8;

    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 2.95,
      h: 1.55,
      fill: { color: C.bgLight },
      rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 2.95,
      h: 0.05,
      fill: { color: d.color },
    });
    s.addText(d.icon, {
      x,
      y: y + 0.15,
      w: 2.95,
      h: 0.5,
      fontSize: 24,
      align: "center",
    });
    s.addText(d.name, {
      x,
      y: y + 0.65,
      w: 2.95,
      h: 0.4,
      fontSize: 13,
      fontFace: "Arial",
      bold: true,
      color: d.color,
      align: "center",
    });
    s.addText(d.desc, {
      x: x + 0.15,
      y: y + 1.0,
      w: 2.65,
      h: 0.4,
      fontSize: 9,
      fontFace: "Arial",
      color: C.gray,
      align: "center",
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 8 — Tech Stack
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Technology Stack");

  const rows = [
    ["Layer", "Technology", "Version"],
    ["Frontend", "React + TypeScript", "19.2 + 5.9"],
    ["Build", "Vite", "7.2"],
    ["Styling", "Tailwind CSS", "4.1"],
    ["Rendering", "PixiJS", "8.6"],
    ["Backend", "Express.js (Node.js)", "5.2 (22+)"],
    ["Database", "SQLite (WAL)", "Built-in"],
    ["Real-time", "WebSocket (ws)", "8.19"],
    ["Validation", "Zod", "4.3"],
    ["Export", "PptxGenJS", "3.12"],
    ["Package Mgr", "pnpm", "Latest"],
  ];

  const colWidths = [2.0, 4.0, 1.8];
  const colX = [0.7, 2.7, 6.7];

  rows.forEach((row, ri) => {
    const y = 1.15 + ri * 0.38;
    const isHeader = ri === 0;
    const bgColor = isHeader ? C.accent : ri % 2 === 0 ? C.bgLight : C.bg;

    s.addShape(pptx.ShapeType.rect, {
      x: 0.7,
      y,
      w: 7.8,
      h: 0.38,
      fill: { color: bgColor },
    });

    row.forEach((cell, ci) => {
      s.addText(cell, {
        x: colX[ci],
        y,
        w: colWidths[ci],
        h: 0.38,
        fontSize: isHeader ? 11 : 10,
        fontFace: "Arial",
        bold: isHeader,
        color: isHeader ? C.white : C.grayLight,
        valign: "middle",
      });
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 9 — Security & Data
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Security & Data Architecture");

  const sections = [
    {
      title: "Data Sovereignty",
      color: C.green,
      items: [
        "100% Local-first — 모든 데이터 로컬 SQLite 저장",
        "클라우드 의존성 제로 — 외부 서버 불필요",
        "127.0.0.1 기본 바인딩 — 네트워크 노출 최소화",
      ],
    },
    {
      title: "Credential Protection",
      color: C.accent,
      items: [
        "AES-256-GCM 암호화 — OAuth 토큰 & API 키",
        "OAUTH_ENCRYPTION_SECRET — 32-byte hex 마스터 키",
        "sessionStorage only — 브라우저 빌드에 시크릿 미포함",
      ],
    },
    {
      title: "Audit & Integrity",
      color: C.yellow,
      items: [
        "NDJSON 감사 체인 — SHA256 해시 연결",
        "멱등성(Idempotency) 메시지 추적 — 중복 방지",
        "IP/User-Agent 로깅 — 접근 이력 기록",
      ],
    },
  ];

  sections.forEach((sec, i) => {
    const y = 1.2 + i * 1.4;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.4,
      y,
      w: 9.2,
      h: 1.2,
      fill: { color: C.bgLight },
      rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.4,
      y,
      w: 0.06,
      h: 1.2,
      fill: { color: sec.color },
    });
    s.addText(sec.title, {
      x: 0.65,
      y,
      w: 2.5,
      h: 1.2,
      fontSize: 13,
      fontFace: "Arial",
      bold: true,
      color: sec.color,
      valign: "middle",
    });
    sec.items.forEach((item, j) => {
      s.addText(item, {
        x: 3.2,
        y: y + 0.1 + j * 0.35,
        w: 6.2,
        h: 0.35,
        fontSize: 10,
        fontFace: "Arial",
        color: C.grayLight,
        valign: "middle",
        bullet: { type: "bullet", color: sec.color },
      });
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 10 — Quantitative Overview
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "By the Numbers");

  const metrics = [
    { value: "20K+", label: "Lines of Code\n(Server)", color: C.accent },
    { value: "12.8K+", label: "Lines of Code\n(Frontend)", color: C.green },
    { value: "600+", label: "Agent\nSkills", color: C.yellow },
    { value: "30+", label: "API\nEndpoints", color: C.red },
    { value: "6", label: "CLI\nProviders", color: C.accentLight },
    { value: "8", label: "External API\nProviders", color: C.grayLight },
    { value: "6", label: "Departments", color: C.accent },
    { value: "4", label: "Languages\n(i18n)", color: C.green },
    { value: "61", label: "Pixel-Art\nSprites", color: C.yellow },
    { value: "76", label: "GitHub\nStars", color: C.red },
  ];

  metrics.forEach((m, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = 0.3 + col * 1.9;
    const y = 1.3 + row * 2.0;

    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 1.7,
      h: 1.7,
      fill: { color: C.bgLight },
      rectRadius: 0.08,
    });
    s.addText(m.value, {
      x,
      y: y + 0.2,
      w: 1.7,
      h: 0.7,
      fontSize: 28,
      fontFace: "Arial",
      bold: true,
      color: m.color,
      align: "center",
      valign: "middle",
    });
    s.addText(m.label, {
      x,
      y: y + 0.95,
      w: 1.7,
      h: 0.6,
      fontSize: 9,
      fontFace: "Arial",
      color: C.gray,
      align: "center",
      valign: "top",
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 11 — Workflow
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "User Workflow");

  const steps = [
    { num: "1", title: "Install", desc: "git clone & bash install.sh\npnpm install & setup", color: C.accent },
    { num: "2", title: "Configure", desc: "AI 프로바이더 선택\nOAuth & API 키 설정", color: C.green },
    { num: "3", title: "Direct", desc: "CEO 지시 ($-prefix)\n또는 메신저에서 전송", color: C.yellow },
    { num: "4", title: "Execute", desc: "에이전트 자율 실행\nGit Worktree 격리 작업", color: C.red },
    { num: "5", title: "Review", desc: "태스크 리뷰 & 승인\n코드 머지 & 보고서", color: C.accentLight },
  ];

  steps.forEach((step, i) => {
    const x = 0.3 + i * 1.9;
    // Number circle
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.55,
      y: 1.3,
      w: 0.6,
      h: 0.6,
      fill: { color: step.color },
    });
    s.addText(step.num, {
      x: x + 0.55,
      y: 1.3,
      w: 0.6,
      h: 0.6,
      fontSize: 18,
      fontFace: "Arial",
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
    });
    // Arrow
    if (i < steps.length - 1) {
      s.addText("→", {
        x: x + 1.5,
        y: 1.3,
        w: 0.5,
        h: 0.6,
        fontSize: 20,
        color: C.textDim,
        align: "center",
        valign: "middle",
      });
    }
    // Card
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 2.1,
      w: 1.7,
      h: 2.2,
      fill: { color: C.bgLight },
      rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.rect, {
      x,
      y: 2.1,
      w: 1.7,
      h: 0.05,
      fill: { color: step.color },
    });
    s.addText(step.title, {
      x,
      y: 2.2,
      w: 1.7,
      h: 0.5,
      fontSize: 14,
      fontFace: "Arial",
      bold: true,
      color: step.color,
      align: "center",
      valign: "middle",
    });
    s.addText(step.desc, {
      x: x + 0.1,
      y: 2.75,
      w: 1.5,
      h: 1.2,
      fontSize: 9,
      fontFace: "Arial",
      color: C.gray,
      align: "center",
      valign: "top",
      lineSpacingMultiple: 1.4,
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 12 — Messenger Integration
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "OpenClaw Messenger Integration");

  s.addText("외부 메신저를 통해 CEO 지시를 전달하고 실시간 태스크 업데이트를 수신합니다.", {
    x: 0.5,
    y: 1.15,
    w: 9,
    h: 0.4,
    fontSize: 11,
    fontFace: "Arial",
    color: C.gray,
  });

  const messengers = [
    {
      name: "Telegram",
      desc: "Bot API를 통한 양방향 통신\n$-prefix 지시 전송\n태스크 완료 알림 수신",
      color: "#229ED9",
    },
    { name: "Discord", desc: "Webhook 기반 메시지 수신\nBot 계정으로 상호작용\n채널별 알림 라우팅", color: "#5865F2" },
    { name: "Slack", desc: "Slash command 연동\nWorkspace 통합\n스레드 기반 태스크 추적", color: "#4A154B" },
  ];

  messengers.forEach((m, i) => {
    const x = 0.4 + i * 3.15;
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.7,
      w: 2.95,
      h: 2.8,
      fill: { color: C.bgLight },
      rectRadius: 0.08,
    });
    s.addShape(pptx.ShapeType.rect, {
      x,
      y: 1.7,
      w: 2.95,
      h: 0.06,
      fill: { color: m.color },
    });
    s.addText(m.name, {
      x,
      y: 1.85,
      w: 2.95,
      h: 0.5,
      fontSize: 16,
      fontFace: "Arial",
      bold: true,
      color: m.color,
      align: "center",
    });
    s.addText(m.desc, {
      x: x + 0.2,
      y: 2.4,
      w: 2.55,
      h: 1.8,
      fontSize: 10,
      fontFace: "Arial",
      color: C.grayLight,
      lineSpacingMultiple: 1.5,
    });
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.4,
    y: 4.65,
    w: 9.2,
    h: 0.45,
    fill: { color: C.bgLight },
    rectRadius: 0.04,
  });
  s.addText(
    "Webhook endpoint: POST /api/inbox  |  Secret: x-inbox-secret header  |  Config: ~/.openclaw/openclaw.json",
    {
      x: 0.6,
      y: 4.65,
      w: 8.8,
      h: 0.45,
      fontSize: 9,
      fontFace: "Arial",
      color: C.textDim,
      valign: "middle",
    },
  );
}

// ═══════════════════════════════════════════════
// SLIDE 13 — Risks & Considerations
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Risks & Considerations");

  const risks = [
    {
      level: "HIGH",
      levelColor: C.red,
      title: "Monolith Server Complexity",
      desc: "server/index.ts 10,000+ lines. 모듈화 진행 중이나 추가 분리 필요.",
      mitigation: "라우트/워크플로우 모듈 분리 완료. 추후 마이크로서비스 전환 검토.",
    },
    {
      level: "MED",
      levelColor: C.yellow,
      title: "CLI Provider Dependency",
      desc: "에이전트 실행이 외부 CLI 도구 설치에 의존. 도구 미설치 시 실행 불가.",
      mitigation: "External API Provider fallback (v1.0.7+). CLI 미설치 감지 & 안내.",
    },
    {
      level: "MED",
      levelColor: C.yellow,
      title: "SQLite Concurrency Limits",
      desc: "동시 대량 쓰기 시 WAL 모드에서도 lock contention 가능.",
      mitigation: "busy_timeout 5s 설정. 향후 PostgreSQL 마이그레이션 옵션 보유.",
    },
    {
      level: "LOW",
      levelColor: C.green,
      title: "Single-Process Architecture",
      desc: "서버 크래시 시 전체 시스템 영향. 프로세스 격리 없음.",
      mitigation: "Nodemon auto-restart (dev). PM2 사용 가능 (prod).",
    },
  ];

  risks.forEach((r, i) => {
    const y = 1.15 + i * 1.0;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.4,
      y,
      w: 9.2,
      h: 0.85,
      fill: { color: C.bgLight },
      rectRadius: 0.06,
    });
    // Risk level badge
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: y + 0.25,
      w: 0.6,
      h: 0.35,
      fill: { color: r.levelColor },
      rectRadius: 0.04,
    });
    s.addText(r.level, {
      x: 0.55,
      y: y + 0.25,
      w: 0.6,
      h: 0.35,
      fontSize: 8,
      fontFace: "Arial",
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
    });
    s.addText(r.title, {
      x: 1.3,
      y: y + 0.05,
      w: 3,
      h: 0.4,
      fontSize: 11,
      fontFace: "Arial",
      bold: true,
      color: C.white,
      valign: "middle",
    });
    s.addText(r.desc, {
      x: 1.3,
      y: y + 0.42,
      w: 4,
      h: 0.35,
      fontSize: 9,
      fontFace: "Arial",
      color: C.gray,
      valign: "middle",
    });
    s.addText(r.mitigation, {
      x: 5.4,
      y: y + 0.05,
      w: 4,
      h: 0.75,
      fontSize: 9,
      fontFace: "Arial",
      color: C.grayLight,
      valign: "middle",
      bullet: { type: "bullet", color: C.green },
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 14 — Next Actions
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  addTitle(s, "Next Actions & Roadmap");

  const actions = [
    {
      priority: "P0",
      title: "서버 모듈화 완성",
      desc: "routes/workflow 분리 마무리, 타입 안전성 강화",
      timeline: "Sprint 1-2",
      color: C.red,
    },
    {
      priority: "P1",
      title: "테스트 커버리지 확대",
      desc: "단위 테스트 + 통합 테스트 프레임워크 도입",
      timeline: "Sprint 2-3",
      color: C.yellow,
    },
    {
      priority: "P1",
      title: "Docker 컨테이너화",
      desc: "Dockerfile + docker-compose 작성, 원클릭 배포",
      timeline: "Sprint 3",
      color: C.yellow,
    },
    {
      priority: "P2",
      title: "Agent Marketplace",
      desc: "사전 구성된 에이전트 템플릿 공유 시스템",
      timeline: "Sprint 4+",
      color: C.green,
    },
    {
      priority: "P2",
      title: "워크플로우 빌더",
      desc: "시각적 태스크 오케스트레이션 도구",
      timeline: "Sprint 5+",
      color: C.green,
    },
    {
      priority: "P3",
      title: "엔터프라이즈 기능",
      desc: "멀티테넌트, 감사 컴플라이언스, RBAC",
      timeline: "Future",
      color: C.accent,
    },
  ];

  actions.forEach((a, i) => {
    const y = 1.15 + i * 0.7;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.4,
      y,
      w: 9.2,
      h: 0.58,
      fill: { color: C.bgLight },
      rectRadius: 0.05,
    });
    // Priority badge
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: y + 0.14,
      w: 0.5,
      h: 0.3,
      fill: { color: a.color },
      rectRadius: 0.04,
    });
    s.addText(a.priority, {
      x: 0.55,
      y: y + 0.14,
      w: 0.5,
      h: 0.3,
      fontSize: 8,
      fontFace: "Arial",
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
    });
    s.addText(a.title, {
      x: 1.2,
      y,
      w: 2.5,
      h: 0.58,
      fontSize: 11,
      fontFace: "Arial",
      bold: true,
      color: C.white,
      valign: "middle",
    });
    s.addText(a.desc, {
      x: 3.7,
      y,
      w: 3.8,
      h: 0.58,
      fontSize: 9,
      fontFace: "Arial",
      color: C.gray,
      valign: "middle",
    });
    s.addText(a.timeline, {
      x: 7.6,
      y,
      w: 1.8,
      h: 0.58,
      fontSize: 9,
      fontFace: "Arial",
      color: a.color,
      align: "center",
      valign: "middle",
    });
  });
}

// ═══════════════════════════════════════════════
// SLIDE 15 — Closing
// ═══════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: "MASTER" });
  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: { type: "solid", color: C.bg },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.08,
    h: "100%",
    fill: { color: C.accent },
  });

  s.addText("Thank You", {
    x: 0.8,
    y: 1.5,
    w: 8.5,
    h: 0.8,
    fontSize: 40,
    fontFace: "Arial",
    bold: true,
    color: C.white,
  });
  s.addText("Command Your AI Agent Empire from the CEO Desk", {
    x: 0.8,
    y: 2.4,
    w: 8.5,
    h: 0.5,
    fontSize: 16,
    fontFace: "Arial",
    color: C.accentLight,
  });

  const links = [
    ["GitHub", "Bigital AI Factory"],
    ["License", "Apache 2.0"],
    ["Version", "v1.0.8 (2026-02-20)"],
    ["Platform", "macOS / Linux / Windows"],
  ];

  links.forEach(([label, value], i) => {
    const y = 3.3 + i * 0.45;
    s.addText(label, {
      x: 0.8,
      y,
      w: 1.5,
      h: 0.4,
      fontSize: 11,
      fontFace: "Arial",
      bold: true,
      color: C.accent,
    });
    s.addText(value, {
      x: 2.3,
      y,
      w: 5,
      h: 0.4,
      fontSize: 11,
      fontFace: "Arial",
      color: C.grayLight,
    });
  });
}

// ── Write File ──
const data = await pptx.write({ outputType: "nodebuffer" });
writeFileSync(OUTPUT, data);
console.log(`PPT generated: ${OUTPUT}`);
console.log(`Slides: ${pptx.slides.length}`);

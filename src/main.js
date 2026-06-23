import "./styles.css";
import { store } from "./dataStore.js";
import { createBlankQuestion, getSubject, SUBJECTS, validateContentDraft, validateQuizDraft } from "./quizLogic.js";

const app = document.querySelector("#app");

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

const state = {
  user: null,
  route: currentPath(),
  selectedChoices: {},
  lastResult: null,
  message: "",
  busy: false,
  shouldScrollTop: true,
  focusStudyOnRender: false,
};

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const CONTENT_TYPES = [
  { id: "quiz", label: "Quick quiz", thai: "Quick quiz", note: "ฝึกเร็วและเก็บ EXP", accent: "#11865b" },
  { id: "clip", label: "คลิป", thai: "คลิป", note: "ดูวิธีคิดจากพี่ KVIS", accent: "#5a35a8" },
  { id: "fact", label: "เกร็ดวิทย์", thai: "เกร็ดวิทย์", note: "วิดีโอสั้นจาก Google Drive ที่ทำให้ STEM ใกล้ตัว", accent: "#0f766e" },
];

const CONTENT_FILTERS = CONTENT_TYPES;
const MAX_QUESTION_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_COVER_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_RESOURCE_FILE_BYTES = 5 * 1024 * 1024;
const EXP_PER_POINT = 100;
const EXP_PER_LEVEL = 500;

const AVATAR_OPTIONS = {
  body: [
    { id: "orbit", label: "นักสำรวจวงโคจร" },
    { id: "lab", label: "นักคิดแล็บ" },
    { id: "spark", label: "นักจุดประกาย" },
    { id: "astro", label: "นักบินอวกาศ" },
    { id: "data", label: "นักวิเคราะห์ข้อมูล" },
    { id: "field", label: "นักธรรมชาติวิทยา" },
  ],
  color: [
    { id: "green", label: "เขียว KVIS", primary: "#2d7046", secondary: "#dff4e7", accent: "#5d4aa7" },
    { id: "purple", label: "ม่วง KVIS", primary: "#5d4aa7", secondary: "#eeeafd", accent: "#2d7046" },
    { id: "teal", label: "เขียวฟ้า STEM", primary: "#0f766e", secondary: "#dff7f4", accent: "#5d4aa7" },
    { id: "blue", label: "น้ำเงินฟิสิกส์", primary: "#2563eb", secondary: "#eaf1ff", accent: "#5d4aa7" },
    { id: "amber", label: "เหลืองเคมี", primary: "#d97706", secondary: "#fff4d8", accent: "#2d7046" },
    { id: "red", label: "แดงคณิต", primary: "#dc2626", secondary: "#ffe9e9", accent: "#5d4aa7" },
  ],
  face: [
    { id: "calm", label: "สงบ" },
    { id: "focus", label: "โฟกัส" },
    { id: "happy", label: "สดใส" },
    { id: "curious", label: "อยากรู้" },
    { id: "determined", label: "ตั้งใจ" },
  ],
  accessory: [
    { id: "spark", label: "ประกาย" },
    { id: "atom", label: "อะตอม" },
    { id: "book", label: "หนังสือ" },
    { id: "leaf", label: "ใบไม้" },
    { id: "flask", label: "หลอดทดลอง" },
    { id: "graph", label: "กราฟ" },
    { id: "compass", label: "เข็มทิศ" },
    { id: "none", label: "ไม่มี" },
  ],
};

const DEFAULT_AVATAR = { body: "orbit", color: "green", face: "calm", accessory: "spark" };

const SUBJECT_BADGE_META = {
  biology: { title: "Bio", thai: "ชีวะ", tone: "green", icon: "leaf" },
  physics: { title: "Physics", thai: "ฟิสิกส์", tone: "purple", icon: "atom" },
  chemistry: { title: "Chem", thai: "เคมี", tone: "green", icon: "flask" },
  math: { title: "Math", thai: "คณิต", tone: "purple", icon: "sigma" },
};

function formatBadgeProgress(value, target, suffix = "") {
  return `${Math.min(Math.round(Number(value) || 0), target)}${suffix}/${target}${suffix}`;
}

function createMilestoneBadge({ id, title, thai, description, requirement, category, tone = "green", icon = "star", target, metric, suffix = "" }) {
  return {
    id,
    title,
    thai,
    description,
    requirement,
    category,
    tone,
    icon,
    rule: (context) => metric(context) >= target,
    progress: (context) => formatBadgeProgress(metric(context), target, suffix),
  };
}

function createBadgeCatalog() {
  const coreBadges = [
    createMilestoneBadge({
      id: "first-quiz",
      title: "First Quiz",
      thai: "ควิซแรก",
      description: "ทำ Quick quiz ครั้งแรกสำเร็จ",
      requirement: "ทำควิซอย่างน้อย 1 ครั้ง",
      category: "Start",
      icon: "check",
      target: 1,
      metric: ({ attempts }) => attempts.length,
    }),
    createMilestoneBadge({
      id: "first-perfect",
      title: "First Perfect",
      thai: "เต็มครั้งแรก",
      description: "ทำควิซได้เต็มคะแนนครั้งแรก",
      requirement: "ได้คะแนนเต็ม 1 ครั้ง",
      category: "Start",
      tone: "purple",
      icon: "medal",
      target: 1,
      metric: ({ perfectCount }) => perfectCount,
    }),
    createMilestoneBadge({
      id: "two-subject-explorer",
      title: "Two-Subject Explorer",
      thai: "ลองสองวิชา",
      description: "เริ่มเรียนมากกว่าหนึ่งวิชา",
      requirement: "ทำควิซอย่างน้อย 2 วิชา",
      category: "Start",
      icon: "compass",
      target: 2,
      metric: ({ subjectsTouched }) => subjectsTouched,
    }),
    createMilestoneBadge({
      id: "all-subject-sampler",
      title: "All-Subject Sampler",
      thai: "ครบสี่วิชา",
      description: "แตะครบชีวะ ฟิสิกส์ เคมี และคณิต",
      requirement: "ทำควิซครบ 4 วิชา",
      category: "Start",
      tone: "purple",
      icon: "compass",
      target: 4,
      metric: ({ subjectsTouched }) => subjectsTouched,
    }),
    ...[
      [3, "Quick Three", "สามควิซ", "เริ่มมีจังหวะการฝึก"],
      [5, "Five-Quest Learner", "ห้าควิซ", "ฝึกครบ 5 Quick quiz"],
      [10, "Ten-Quest Track", "สิบควิซ", "ทำควิซครบหลักสิบ"],
      [20, "Twenty-Quest Builder", "ยี่สิบควิซ", "เริ่มสร้างฐานความรู้จริงจัง"],
      [50, "Fifty-Quest Scholar", "ห้าสิบควิซ", "ฝึกต่อเนื่องจนเห็นความต่าง"],
      [100, "Century Quizzer", "ร้อยควิซ", "ทำ Quick quiz ครบ 100 ครั้ง"],
    ].map(([target, title, thai, description]) =>
      createMilestoneBadge({
        id: `quiz-count-${target}`,
        title,
        thai,
        description,
        requirement: `ทำ Quick quiz ${target} ครั้ง`,
        category: "Start",
        icon: "check",
        target,
        metric: ({ attempts }) => attempts.length,
      }),
    ),
  ];

  const expBadges = [100, 300, 500, 1000, 1500, 2500, 5000, 7500, 10000, 15000, 25000, 50000].map((target) =>
    createMilestoneBadge({
      id: `exp-${target}`,
      title: `${target.toLocaleString()} EXP`,
      thai: `สะสม ${target.toLocaleString()} EXP`,
      description: "เก็บ EXP จากการทำควิซและโจทย์ฝึก",
      requirement: `สะสม EXP รวม ${target.toLocaleString()}`,
      category: "EXP",
      tone: target >= 1000 ? "purple" : "green",
      icon: "bolt",
      target,
      metric: ({ totalExp }) => totalExp,
    }),
  );

  const levelBadges = [2, 3, 5, 7, 10, 15, 20, 30].map((target) => ({
    ...createMilestoneBadge({
      id: `level-${target}`,
      title: `Level ${target}`,
      thai: `เลเวล ${target}`,
      description: "ยกระดับจาก EXP ที่สะสม",
      requirement: `ไปถึง Level ${target}`,
      category: "Level",
      tone: "purple",
      icon: "level",
      target,
      metric: ({ level }) => level,
    }),
    progress: ({ level }) => `Lv.${Math.min(level, target)}/Lv.${target}`,
  }));

  const dayBadges = [1, 2, 3, 5, 7, 10, 14, 21, 30, 60].map((target) =>
    createMilestoneBadge({
      id: `learning-days-${target}`,
      title: `${target}-Day Learner`,
      thai: `เรียน ${target} วัน`,
      description: "กลับมาเรียนในวันที่แตกต่างกัน",
      requirement: `ทำควิซใน ${target} วันที่แตกต่างกัน`,
      category: "Consistency",
      tone: target >= 7 ? "purple" : "green",
      icon: "calendar",
      target,
      metric: ({ learningDays }) => learningDays,
    }),
  );

  const perfectBadges = [2, 3, 5, 10, 15, 25, 50, 75].map((target) =>
    createMilestoneBadge({
      id: `perfect-count-${target}`,
      title: `${target} Perfects`,
      thai: `เต็ม ${target} ครั้ง`,
      description: "ทำควิซได้เต็มคะแนนหลายครั้ง",
      requirement: `ได้คะแนนเต็ม ${target} ครั้ง`,
      category: "Accuracy",
      tone: "purple",
      icon: "medal",
      target,
      metric: ({ perfectCount }) => perfectCount,
    }),
  );

  const bestScoreBadges = [50, 60, 70, 80, 90, 95, 100].map((target) =>
    createMilestoneBadge({
      id: `best-score-${target}`,
      title: `Best ${target}%`,
      thai: `ดีที่สุด ${target}%`,
      description: "ทำคะแนนรอบที่ดีที่สุดถึงเป้าหมาย",
      requirement: `มีควิซที่ได้อย่างน้อย ${target}%`,
      category: "Accuracy",
      tone: target >= 90 ? "purple" : "green",
      icon: "target",
      target,
      metric: ({ bestPercent }) => bestPercent,
      suffix: "%",
    }),
  );

  const averageBadges = [50, 60, 70, 80, 90].map((target) =>
    createMilestoneBadge({
      id: `average-score-${target}`,
      title: `Average ${target}%`,
      thai: `เฉลี่ย ${target}%`,
      description: "รักษาคะแนนเฉลี่ยจากทุกควิซ",
      requirement: `คะแนนเฉลี่ยรวมอย่างน้อย ${target}%`,
      category: "Accuracy",
      tone: target >= 80 ? "purple" : "green",
      icon: "target",
      target,
      metric: ({ averagePercent }) => averagePercent,
      suffix: "%",
    }),
  );

  const subjectCountBadges = SUBJECTS.flatMap((subject) => {
    const meta = SUBJECT_BADGE_META[subject.id];
    return [
      [1, "Starter", "เริ่มต้น"],
      [3, "Builder", "กำลังสร้างฐาน"],
      [5, "Regular", "ฝึกต่อเนื่อง"],
      [10, "Pathmaker", "ทำเป็นเส้นทาง"],
      [20, "Specialist", "เชี่ยวชาญขึ้น"],
    ].map(([target, titleSuffix, thaiSuffix]) =>
      createMilestoneBadge({
        id: `${subject.id}-quiz-${target}`,
        title: `${meta.title} ${titleSuffix}`,
        thai: `${meta.thai}${thaiSuffix}`,
        description: `ทำ Quick quiz ใน${subject.label}ครบ ${target} ครั้ง`,
        requirement: `ทำควิซ${subject.label} ${target} ครั้ง`,
        category: "Subjects",
        tone: meta.tone,
        icon: meta.icon,
        target,
        metric: ({ subjectStats }) => subjectStats[subject.id].count,
      }),
    );
  });

  const subjectExpBadges = SUBJECTS.flatMap((subject) => {
    const meta = SUBJECT_BADGE_META[subject.id];
    return [300, 1000, 2500].map((target) =>
      createMilestoneBadge({
        id: `${subject.id}-exp-${target}`,
        title: `${meta.title} ${target} EXP`,
        thai: `${meta.thai} ${target} EXP`,
        description: `สะสม EXP จาก${subject.label}`,
        requirement: `สะสม ${target} EXP ใน${subject.label}`,
        category: "Subjects",
        tone: target >= 1000 ? "purple" : meta.tone,
        icon: meta.icon,
        target,
        metric: ({ subjectStats }) => subjectStats[subject.id].exp,
      }),
    );
  });

  const subjectAccuracyBadges = SUBJECTS.flatMap((subject) => {
    const meta = SUBJECT_BADGE_META[subject.id];
    return [80, 100].map((target) =>
      createMilestoneBadge({
        id: `${subject.id}-best-${target}`,
        title: `${meta.title} ${target}%`,
        thai: `${meta.thai} ${target}%`,
        description: `ทำคะแนนสูงใน${subject.label}`,
        requirement: `มีควิซ${subject.label}ที่ได้อย่างน้อย ${target}%`,
        category: "Subjects",
        tone: target === 100 ? "purple" : meta.tone,
        icon: target === 100 ? "medal" : meta.icon,
        target,
        metric: ({ subjectStats }) => subjectStats[subject.id].bestPercent,
        suffix: "%",
      }),
    );
  });

  return [
    ...coreBadges,
    ...expBadges,
    ...levelBadges,
    ...dayBadges,
    ...perfectBadges,
    ...bestScoreBadges,
    ...averageBadges,
    ...subjectCountBadges,
    ...subjectExpBadges,
    ...subjectAccuracyBadges,
  ];
}

const BADGE_CATALOG = createBadgeCatalog();

function navigate(path) {
  history.pushState({}, "", path);
  state.route = path;
  state.message = "";
  state.lastResult = null;
  state.shouldScrollTop = true;
  render();
}

window.addEventListener("popstate", () => {
  state.route = currentPath();
  state.shouldScrollTop = true;
  render();
});

function setMessage(message) {
  state.message = message;
  render();
}

function displayText(value = "", fallback = "") {
  return String(value || fallback)
    .replace(/admin builder/gi, "เครื่องมือ Creator")
    .replace(/untitled/gi, "ยังไม่ตั้งชื่อ")
    .trim();
}

function statusLabel(status = "draft") {
  return status === "published" ? "เผยแพร่" : "ฉบับร่าง";
}

function scoreToExp(score = 0) {
  return Number(score || 0) * EXP_PER_POINT;
}

function getExpProgress(totalExp = 0) {
  const level = Math.floor(totalExp / EXP_PER_LEVEL) + 1;
  const currentLevelExp = totalExp % EXP_PER_LEVEL;
  const percent = Math.round((currentLevelExp / EXP_PER_LEVEL) * 100);
  return {
    level,
    totalExp,
    currentLevelExp,
    nextLevelExp: EXP_PER_LEVEL,
    percent,
  };
}

function totalAttemptExp(attempts = []) {
  return attempts.reduce((total, attempt) => total + scoreToExp(attempt.score), 0);
}

function attemptPercent(attempt) {
  return attempt?.maxScore ? Math.round((Number(attempt.score || 0) / Number(attempt.maxScore)) * 100) : 0;
}

function needsOnboarding(user) {
  return Boolean(user && user.role === "student" && !user.onboardedAt);
}

function getLearningDayCount(attempts = []) {
  return new Set(
    attempts
      .map((attempt) => {
        const date = new Date(attempt.submittedAt);
        return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
      })
      .filter(Boolean),
  ).size;
}

function getAchievementBadges(attempts = []) {
  const totalExp = totalAttemptExp(attempts);
  const subjectStats = Object.fromEntries(
    SUBJECTS.map((subject) => {
      const subjectAttempts = attempts.filter((attempt) => attempt.subject === subject.id);
      return [
        subject.id,
        {
          count: subjectAttempts.length,
          exp: totalAttemptExp(subjectAttempts),
          bestPercent: subjectAttempts.reduce((best, attempt) => Math.max(best, attemptPercent(attempt)), 0),
        },
      ];
    }),
  );
  const validPercentAttempts = attempts.filter((attempt) => Number(attempt.maxScore) > 0);
  const context = {
    attempts,
    totalExp,
    level: getExpProgress(totalExp).level,
    learningDays: getLearningDayCount(attempts),
    subjectsTouched: Object.values(subjectStats).filter((stats) => stats.count > 0).length,
    perfectCount: attempts.filter((attempt) => Number(attempt.maxScore) > 0 && Number(attempt.score) >= Number(attempt.maxScore)).length,
    bestPercent: attempts.reduce((best, attempt) => Math.max(best, attemptPercent(attempt)), 0),
    averagePercent: validPercentAttempts.length
      ? Math.round(validPercentAttempts.reduce((total, attempt) => total + attemptPercent(attempt), 0) / validPercentAttempts.length)
      : 0,
    subjectStats,
  };
  return BADGE_CATALOG.map((badge) => ({
    ...badge,
    unlocked: badge.rule(context),
    progressText: badge.progress(context),
  }));
}

function getAvatarConfig(userOrDraft = {}) {
  return {
    ...DEFAULT_AVATAR,
    ...(userOrDraft.avatar || userOrDraft),
  };
}

function getAvatarColor(colorId) {
  return AVATAR_OPTIONS.color.find((color) => color.id === colorId) || AVATAR_OPTIONS.color[0];
}

function renderAvatar(userOrDraft = {}, { compact = false } = {}) {
  const avatar = getAvatarConfig(userOrDraft);
  const color = getAvatarColor(avatar.color);
  const accessory = avatar.accessory || "spark";
  const face = avatar.face || "calm";
  const gradientId = `avatar-grad-${escapeHtml(color.id)}-${escapeHtml(avatar.body)}-${escapeHtml(face)}-${escapeHtml(accessory)}`;
  const accent = color.accent || "#5d4aa7";
  const faceMarks = {
    calm: `
      <circle cx="70" cy="88" r="5" fill="#dff7f4" />
      <circle cx="91" cy="88" r="5" fill="#dff7f4" />
      <path d="M72 102c8 6 18 6 26 0" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
    `,
    focus: `
      <rect x="65" y="85" width="11" height="8" rx="3" fill="#dff7f4" />
      <rect x="86" y="85" width="11" height="8" rx="3" fill="#dff7f4" />
      <path d="M73 102h21" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
    `,
    happy: `
      <path d="M65 87c4-5 9-5 13 0M84 87c4-5 9-5 13 0" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
      <path d="M69 101c8 9 24 9 32 0" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
    `,
    curious: `
      <circle cx="69" cy="88" r="5" fill="#dff7f4" />
      <path d="M86 87c4-4 9-4 13 0" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
      <path d="M75 102c5 4 14 5 22 1" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
      <path d="M63 78c6-4 12-5 18-2" fill="none" stroke="#dff7f4" stroke-width="3" stroke-linecap="round" opacity=".75" />
    `,
    determined: `
      <path d="M64 85l13 5M98 85l-13 5" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
      <path d="M74 102h19" fill="none" stroke="#dff7f4" stroke-width="5" stroke-linecap="round" />
    `,
  };
  const visor = `
    <rect x="52" y="70" width="56" height="42" rx="20" fill="#10221a" opacity=".92" />
    ${faceMarks[face] || faceMarks.calm}
  `;
  const bodyProfiles = {
    orbit: `
      <path d="M42 96c0-25 16-42 38-42s38 17 38 42v22c0 11-8 18-20 18H62c-12 0-20-7-20-18V96Z" fill="url(#${gradientId})" />
      <path d="M54 79c6-20 19-31 38-30 12 1 23 7 31 17-8-27-25-41-50-38-20 3-34 16-42 39 8-4 15-6 23-8Z" fill="#ffffff" opacity=".3" />
      <ellipse cx="80" cy="83" rx="61" ry="23" fill="none" stroke="#ffffff" stroke-width="4" opacity=".54" transform="rotate(-18 80 83)" />
      ${visor}
    `,
    lab: `
      <path d="M38 96c0-28 17-46 42-46s42 18 42 46v17c0 8-3 15-9 20l-8 11H55l-8-11c-6-5-9-12-9-20V96Z" fill="url(#${gradientId})" />
      <path d="M48 112h64l-10 32H58l-10-32Z" fill="#ffffff" opacity=".94" />
      <path d="M66 116v24M94 116v24M75 125h10M75 134h10" stroke="${escapeHtml(color.primary)}" stroke-width="4" stroke-linecap="round" />
      <path d="M48 78c8-22 23-34 45-31 14 2 25 10 32 24-9-6-19-9-31-9-18 0-33 5-46 16Z" fill="#ffffff" opacity=".24" />
      ${visor}
    `,
    spark: `
      <path d="M80 39l18 19 24 3-10 21 8 24-20 10-8 25H68l-8-25-20-10 8-24-10-21 24-3 18-19Z" fill="url(#${gradientId})" />
      <path d="M54 62 38 47M106 62l16-15M48 124l-16 9M112 124l16 9" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".5" />
      <path d="M59 121c13 10 29 10 42 0l-5 22H64l-5-22Z" fill="#ffffff" opacity=".32" />
      ${visor}
    `,
    astro: `
      <circle cx="80" cy="84" r="48" fill="url(#${gradientId})" />
      <circle cx="80" cy="84" r="56" fill="none" stroke="#ffffff" stroke-width="8" opacity=".58" />
      <path d="M48 119h64l10 26H38l10-26Z" fill="url(#${gradientId})" opacity=".9" />
      <circle cx="31" cy="87" r="12" fill="${escapeHtml(accent)}" opacity=".78" />
      <circle cx="129" cy="87" r="12" fill="${escapeHtml(accent)}" opacity=".78" />
      <path d="M60 124h40M70 136h20" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".68" />
      ${visor}
    `,
    data: `
      <rect x="38" y="45" width="84" height="96" rx="18" fill="url(#${gradientId})" />
      <path d="M50 57h60M50 127h60" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".35" />
      <path d="M45 101H31M129 101h-14M62 134v-12M80 136v-14M98 134v-12" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".72" />
      <circle cx="62" cy="119" r="3" fill="#ffffff" opacity=".82" />
      <circle cx="80" cy="120" r="3" fill="#ffffff" opacity=".82" />
      <circle cx="98" cy="119" r="3" fill="#ffffff" opacity=".82" />
      ${visor}
    `,
    field: `
      <path d="M35 96c3-31 23-49 45-49s42 18 45 49c2 24-8 42-31 48H66c-23-6-33-24-31-48Z" fill="url(#${gradientId})" />
      <path d="M48 70c18-23 41-32 69-26-10 11-24 19-43 24-12 3-21 4-26 2Z" fill="#ffffff" opacity=".25" />
      <path d="M44 119c18 1 31-6 39-22-19 0-32 8-39 22ZM76 142c18-4 30-15 36-34-18 3-31 14-36 34Z" fill="#ffffff" opacity=".58" />
      ${visor}
    `,
  };
  const accessoryMarks = {
    atom: `<g transform="translate(112 36)" fill="none" stroke="${escapeHtml(color.primary)}" stroke-width="4"><ellipse cx="16" cy="16" rx="15" ry="6" /><ellipse cx="16" cy="16" rx="15" ry="6" transform="rotate(60 16 16)" /><ellipse cx="16" cy="16" rx="15" ry="6" transform="rotate(120 16 16)" /><circle cx="16" cy="16" r="3" fill="${escapeHtml(color.primary)}" /></g>`,
    book: `<path d="M111 34h29v34h-29c-6 0-9 3-9 3V39s3-5 9-5Z" fill="#fff" stroke="${escapeHtml(color.primary)}" stroke-width="4" /><path d="M121 43h12M121 53h10" stroke="${escapeHtml(color.primary)}" stroke-width="3" stroke-linecap="round" />`,
    leaf: `<path d="M108 55c8-18 22-25 37-23 0 18-12 32-32 36 9-9 16-18 20-28" fill="#fff" stroke="${escapeHtml(color.primary)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
    flask: `<path d="M120 33h20M126 33v18l-15 26h44l-15-26V33" fill="#fff" stroke="${escapeHtml(color.primary)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" /><path d="M120 66h26" stroke="${escapeHtml(color.primary)}" stroke-width="3" stroke-linecap="round" />`,
    graph: `<path d="M111 69h35M111 69V36" fill="none" stroke="${escapeHtml(color.primary)}" stroke-width="4" stroke-linecap="round" /><path d="M116 61l9-9 8 5 11-17" fill="none" stroke="${escapeHtml(color.primary)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
    compass: `<circle cx="128" cy="53" r="21" fill="#fff" stroke="${escapeHtml(color.primary)}" stroke-width="4" /><path d="m136 44-6 17-15 5 6-17 15-5Z" fill="none" stroke="${escapeHtml(color.primary)}" stroke-width="3" stroke-linejoin="round" />`,
    spark: `<path d="M122 34l6 15 15 6-15 6-6 15-6-15-15-6 15-6 6-15Z" fill="#ffffff" stroke="${escapeHtml(color.primary)}" stroke-width="4" />`,
    none: "",
  };
  return `
    <svg class="student-avatar ${compact ? "compact" : ""}" viewBox="0 0 160 160" role="img" aria-label="KVISdom avatar">
      <defs>
        <linearGradient id="${gradientId}" x1="20" y1="24" x2="136" y2="144" gradientUnits="userSpaceOnUse">
          <stop stop-color="${escapeHtml(color.primary)}" />
          <stop offset="1" stop-color="${escapeHtml(accent)}" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="72" fill="${escapeHtml(color.secondary)}" />
      ${bodyProfiles[avatar.body] || bodyProfiles.orbit}
      ${accessoryMarks[accessory] || accessoryMarks.spark}
    </svg>
  `;
}

function renderAvatarPicker(user = {}) {
  const avatar = getAvatarConfig(user);
  return `
    <section class="avatar-designer">
      <div class="avatar-preview-card" data-avatar-preview>
        ${renderAvatar({ avatar })}
      </div>
      <div class="avatar-controls">
        <label>รูปแบบ
          <select name="avatarBody" data-action="avatar-option">
            ${AVATAR_OPTIONS.body.map((option) => `<option value="${option.id}" ${avatar.body === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
          </select>
        </label>
        <label>พาเลตต์
          <select name="avatarColor" data-action="avatar-option">
            ${AVATAR_OPTIONS.color.map((option) => `<option value="${option.id}" ${avatar.color === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
          </select>
        </label>
        <label>สีหน้า
          <select name="avatarFace" data-action="avatar-option">
            ${AVATAR_OPTIONS.face.map((option) => `<option value="${option.id}" ${avatar.face === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
          </select>
        </label>
        <label>สัญลักษณ์
          <select name="avatarAccessory" data-action="avatar-option">
            ${AVATAR_OPTIONS.accessory.map((option) => `<option value="${option.id}" ${avatar.accessory === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>
  `;
}

function getBadgeTier(badge) {
  const target = Number(badge.target) || 0;
  const id = badge.id || "";
  if (badge.category === "EXP") {
    if (target >= 25000) return "legendary";
    if (target >= 7500) return "elite";
    if (target >= 1000) return "advanced";
    if (target >= 300) return "solid";
    return "starter";
  }
  if (badge.category === "Level") {
    if (target >= 20) return "legendary";
    if (target >= 10) return "elite";
    if (target >= 5) return "advanced";
    return "solid";
  }
  if (badge.category === "Consistency") {
    if (target >= 60) return "legendary";
    if (target >= 21) return "elite";
    if (target >= 7) return "advanced";
    if (target >= 3) return "solid";
    return "starter";
  }
  if (badge.category === "Accuracy") {
    if (target >= 100 || id.includes("perfect-count-75")) return "legendary";
    if (target >= 90 || id.includes("perfect-count-25") || id.includes("perfect-count-50")) return "elite";
    if (target >= 80 || id.includes("perfect-count-10") || id.includes("perfect-count-15")) return "advanced";
    if (target >= 60 || id.includes("perfect-count-3") || id.includes("perfect-count-5")) return "solid";
    return "starter";
  }
  if (badge.category === "Subjects") {
    if (target >= 2500 || target >= 100 && id.includes("-best-")) return "elite";
    if (target >= 1000 || target >= 20 || target >= 80) return "advanced";
    if (target >= 300 || target >= 5) return "solid";
    return "starter";
  }
  if (target >= 100) return "legendary";
  if (target >= 50) return "elite";
  if (target >= 10) return "advanced";
  if (target >= 3) return "solid";
  return "starter";
}

function hashBadgeId(value = "") {
  return String(value).split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function getBadgeVisualKind(badge) {
  const id = badge.id || "";
  if (badge.category === "EXP") return "exp";
  if (badge.category === "Level") return "level";
  if (badge.category === "Consistency") return "streak";
  if (badge.category === "Accuracy") return id.includes("perfect") ? "perfect" : "accuracy";
  if (badge.category === "Subjects") {
    if (id.includes("-exp-")) return "subject-exp";
    if (id.includes("-best-")) return "subject-mastery";
    if (id.includes("-quiz-")) return "subject-quiz";
    return "subject";
  }
  if (id.includes("perfect")) return "perfect";
  if (id.includes("quiz-count")) return "quiz-count";
  return "start";
}

function renderBadgeIcon(badge, { preview = false } = {}) {
  const active = badge.unlocked || preview;
  const isPurple = badge.tone === "purple";
  const main = isPurple ? "#5d4aa7" : "#2d7046";
  const soft = isPurple ? "#f1effa" : "#e8f7ee";
  const tier = getBadgeTier(badge);
  const kind = getBadgeVisualKind(badge);
  const gold = "#d99a25";
  const ink = "#10221a";
  const gradientId = `badge-grad-${escapeHtml(badge.id || "badge")}`;
  const pipCount = { starter: 0, solid: 1, advanced: 2, elite: 3, legendary: 4 }[tier] || 0;
  const seed = hashBadgeId(badge.id);
  const pips = Array.from({ length: pipCount }, (_, index) => {
    const angle = ((index * 360) / Math.max(pipCount, 1) - 88 + (seed % 24)) * (Math.PI / 180);
    const radius = tier === "legendary" ? 60 : 58;
    const x = 80 + Math.cos(angle) * radius;
    const y = 80 + Math.sin(angle) * radius;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${tier === "legendary" ? 4.2 : 3.4}" fill="${tier === "starter" ? main : gold}" opacity="${active ? ".95" : ".28"}" />`;
  }).join("");
  const tierFrames = {
    starter: `
      <circle cx="80" cy="80" r="68" fill="${soft}" />
      <circle cx="80" cy="80" r="54" fill="#ffffff" stroke="${main}" stroke-width="5" opacity="${active ? "1" : ".46"}" />
    `,
    solid: `
      <circle cx="80" cy="80" r="68" fill="${soft}" />
      <circle cx="80" cy="80" r="58" fill="#ffffff" stroke="${main}" stroke-width="5" opacity="${active ? "1" : ".42"}" />
      <circle cx="80" cy="80" r="45" fill="none" stroke="${main}" stroke-width="3" stroke-dasharray="5 8" opacity="${active ? ".34" : ".16"}" />
    `,
    advanced: `
      <circle cx="80" cy="80" r="69" fill="url(#${gradientId})" opacity="${active ? ".18" : ".08"}" />
      <circle cx="80" cy="80" r="59" fill="#ffffff" stroke="${main}" stroke-width="6" opacity="${active ? "1" : ".44"}" />
      <circle cx="80" cy="80" r="46" fill="none" stroke="${gold}" stroke-width="4" opacity="${active ? ".72" : ".2"}" />
    `,
    elite: `
      <circle cx="80" cy="80" r="70" fill="url(#${gradientId})" opacity="${active ? ".28" : ".1"}" />
      <path d="M42 128c11 9 24 15 38 17 14-2 27-8 38-17l-8 20-30-13-30 13-8-20Z" fill="${gold}" opacity="${active ? ".78" : ".24"}" />
      <path d="M37 101c-10-22-3-47 16-61M123 101c10-22 3-47-16-61" fill="none" stroke="${main}" stroke-width="6" stroke-linecap="round" opacity="${active ? ".48" : ".18"}" />
      <circle cx="80" cy="80" r="58" fill="#ffffff" stroke="${main}" stroke-width="6" opacity="${active ? "1" : ".46"}" />
      <circle cx="80" cy="80" r="44" fill="none" stroke="${gold}" stroke-width="4" opacity="${active ? ".92" : ".28"}" />
    `,
    legendary: `
      <circle cx="80" cy="80" r="72" fill="url(#${gradientId})" opacity="${active ? ".38" : ".12"}" />
      <path d="M49 126h62l-12 24-19-11-19 11-12-24Z" fill="${gold}" opacity="${active ? ".92" : ".28"}" />
      <path d="M36 103c-13-27-3-57 21-73M124 103c13-27 3-57-21-73" fill="none" stroke="${gold}" stroke-width="7" stroke-linecap="round" opacity="${active ? ".84" : ".24"}" />
      <path d="M80 20l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2 7-15Z" fill="${gold}" opacity="${active ? ".95" : ".28"}" />
      <circle cx="80" cy="84" r="57" fill="#ffffff" stroke="${main}" stroke-width="7" opacity="${active ? "1" : ".48"}" />
      <circle cx="80" cy="84" r="43" fill="none" stroke="${gold}" stroke-width="5" opacity="${active ? ".96" : ".3"}" />
    `,
  };
  const kindFrames = {
    start: tierFrames[tier] || tierFrames.starter,
    "quiz-count": `
      <path d="M36 35h80c9 0 16 7 16 16v71c0 9-7 16-16 16H44c-9 0-16-7-16-16V43c0-4 3-8 8-8Z" fill="${soft}" />
      <path d="M45 27h74c8 0 14 6 14 14v75c0 8-6 14-14 14H45c-8 0-14-6-14-14V41c0-8 6-14 14-14Z" fill="#ffffff" stroke="${main}" stroke-width="${tier === "legendary" ? "7" : "5"}" opacity="${active ? "1" : ".64"}" />
      <path d="M45 28h22v35l-11-7-11 7V28Z" fill="${tier === "starter" ? main : gold}" opacity="${active ? ".9" : ".42"}" />
      <path d="M77 47h34M77 63h24" stroke="${main}" stroke-width="5" stroke-linecap="round" opacity="${active ? ".3" : ".18"}" />
    `,
    exp: `
      <path d="M80 17c20 16 42 18 52 18 6 45-12 83-52 108C40 118 22 80 28 35c10 0 32-2 52-18Z" fill="url(#${gradientId})" opacity="${active ? ".3" : ".15"}" />
      <path d="M80 29c17 12 33 15 43 16 3 37-12 65-43 86-31-21-46-49-43-86 10-1 26-4 43-16Z" fill="#ffffff" stroke="${main}" stroke-width="${tier === "legendary" ? "7" : "5"}" opacity="${active ? "1" : ".66"}" />
      <path d="M41 45c9 1 24-2 39-12 15 10 30 13 39 12" fill="none" stroke="${gold}" stroke-width="4" stroke-linecap="round" opacity="${active ? ".72" : ".32"}" />
    `,
    level: `
      <path d="M80 19 132 58l-20 70H48L28 58 80 19Z" fill="url(#${gradientId})" opacity="${active ? ".26" : ".13"}" />
      <path d="M80 31 119 61l-15 58H56L41 61 80 31Z" fill="#ffffff" stroke="${main}" stroke-width="${tier === "legendary" ? "7" : "5"}" opacity="${active ? "1" : ".66"}" />
      <path d="M56 115 80 59l24 56H56Z" fill="${soft}" stroke="${gold}" stroke-width="4" stroke-linejoin="round" opacity="${active ? ".8" : ".38"}" />
    `,
    streak: `
      <rect x="30" y="34" width="100" height="100" rx="18" fill="${soft}" stroke="${main}" stroke-width="${tier === "legendary" ? "7" : "5"}" opacity="${active ? "1" : ".66"}" />
      <path d="M30 60h100" stroke="${main}" stroke-width="6" opacity="${active ? ".72" : ".32"}" />
      <path d="M56 26v20M104 26v20" stroke="${gold}" stroke-width="7" stroke-linecap="round" opacity="${active ? ".86" : ".38"}" />
      <circle cx="80" cy="92" r="31" fill="#ffffff" stroke="${gold}" stroke-width="4" opacity="${active ? ".9" : ".42"}" />
    `,
    perfect: `
      <path d="M49 121h62l-12 25-19-11-19 11-12-25Z" fill="${gold}" opacity="${active ? ".76" : ".3"}" />
      <circle cx="80" cy="75" r="54" fill="#ffffff" stroke="${main}" stroke-width="${tier === "legendary" ? "7" : "5"}" opacity="${active ? "1" : ".66"}" />
      <circle cx="80" cy="75" r="40" fill="${soft}" stroke="${gold}" stroke-width="4" opacity="${active ? ".9" : ".38"}" />
    `,
    accuracy: `
      <path d="M80 22c31 0 56 25 56 56s-25 56-56 56-56-25-56-56 25-56 56-56Z" fill="${soft}" stroke="${main}" stroke-width="${tier === "legendary" ? "7" : "5"}" opacity="${active ? "1" : ".66"}" />
      <circle cx="80" cy="78" r="42" fill="#ffffff" stroke="${gold}" stroke-width="4" opacity="${active ? ".88" : ".38"}" />
      <path d="M80 17v18M80 121v18M19 78h18M123 78h18" stroke="${main}" stroke-width="5" stroke-linecap="round" opacity="${active ? ".45" : ".2"}" />
    `,
    "subject-quiz": `
      <rect x="27" y="37" width="104" height="88" rx="18" fill="#ffffff" stroke="${main}" stroke-width="${tier === "elite" ? "6" : "5"}" opacity="${active ? "1" : ".66"}" />
      <path d="M43 38v86" stroke="${main}" stroke-width="5" opacity="${active ? ".42" : ".2"}" />
      <path d="M55 55h47M55 72h35" stroke="${gold}" stroke-width="5" stroke-linecap="round" opacity="${active ? ".72" : ".34"}" />
      <path d="M102 39h22v32l-11-7-11 7V39Z" fill="${gold}" opacity="${active ? ".86" : ".36"}" />
    `,
    "subject-exp": `
      <path d="M80 21 126 47v66l-46 26-46-26V47L80 21Z" fill="url(#${gradientId})" opacity="${active ? ".25" : ".12"}" />
      <path d="M80 34 114 53v51l-34 20-34-20V53l34-19Z" fill="#ffffff" stroke="${main}" stroke-width="${tier === "elite" ? "6" : "5"}" opacity="${active ? "1" : ".66"}" />
      <circle cx="113" cy="113" r="17" fill="${gold}" opacity="${active ? ".9" : ".36"}" />
      <path d="m116 101-15 19h11l-4 13 15-20h-10l3-12Z" fill="#ffffff" opacity="${active ? ".96" : ".6"}" />
    `,
    "subject-mastery": `
      <path d="M50 123h60l-11 24-19-11-19 11-11-24Z" fill="${gold}" opacity="${active ? ".82" : ".32"}" />
      <circle cx="80" cy="74" r="54" fill="#ffffff" stroke="${main}" stroke-width="${tier === "elite" ? "7" : "5"}" opacity="${active ? "1" : ".66"}" />
      <path d="M80 31l10 24 26 3-20 17 6 26-22-14-22 14 6-26-20-17 26-3 10-24Z" fill="${soft}" stroke="${gold}" stroke-width="4" stroke-linejoin="round" opacity="${active ? ".9" : ".4"}" />
    `,
    subject: tierFrames[tier] || tierFrames.starter,
  };
  const icon = badge.icon || "star";
  const symbols = {
    check: `<path d="M55 79l16 16 35-40" fill="none" stroke="${main}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />`,
    leaf: `<path d="M81 108c21-18 28-43 18-62-23 4-40 20-44 43 17 1 33-5 44-21M77 109c-8-20-20-31-37-35-7 20 1 38 20 49" fill="none" stroke="${main}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`,
    calendar: `<path d="M43 52h74v62H43z" fill="none" stroke="${main}" stroke-width="8" stroke-linejoin="round" /><path d="M58 42v20M102 42v20M58 80h8M78 80h8M98 80h8M58 98h8M78 98h8M98 98h8" stroke="${main}" stroke-width="7" stroke-linecap="round" />`,
    bolt: `<path d="M91 35 52 86h27l-10 39 40-53H82l9-37Z" fill="none" stroke="${main}" stroke-width="8" stroke-linejoin="round" />`,
    level: `<path d="M43 109 80 44l37 65H43Z" fill="none" stroke="${main}" stroke-width="8" stroke-linejoin="round" /><path d="M64 94h32M72 80h16" stroke="${main}" stroke-width="7" stroke-linecap="round" />`,
    medal: `<path d="M61 38h38l-11 31H72L61 38Z" fill="none" stroke="${main}" stroke-width="8" stroke-linejoin="round" /><circle cx="80" cy="94" r="24" fill="none" stroke="${main}" stroke-width="8" /><path d="M80 80l5 10 11 2-8 8 2 12-10-6-10 6 2-12-8-8 11-2 5-10Z" fill="${main}" />`,
    target: `<circle cx="80" cy="80" r="34" fill="none" stroke="${main}" stroke-width="8" /><circle cx="80" cy="80" r="17" fill="none" stroke="${main}" stroke-width="7" /><path d="M80 38v18M80 104v18M38 80h18M104 80h18" stroke="${main}" stroke-width="7" stroke-linecap="round" />`,
    atom: `<g fill="none" stroke="${main}" stroke-width="7"><ellipse cx="80" cy="80" rx="42" ry="17" /><ellipse cx="80" cy="80" rx="42" ry="17" transform="rotate(60 80 80)" /><ellipse cx="80" cy="80" rx="42" ry="17" transform="rotate(120 80 80)" /></g><circle cx="80" cy="80" r="6" fill="${main}" />`,
    flask: `<path d="M64 39h32M72 39v28l-26 47h68L88 67V39" fill="none" stroke="${main}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" /><path d="M59 98h42" stroke="${main}" stroke-width="7" stroke-linecap="round" />`,
    sigma: `<path d="M109 45H55l32 35-32 35h58" fill="none" stroke="${main}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />`,
    compass: `<path d="M80 37a43 43 0 1 1 0 86 43 43 0 0 1 0-86Z" fill="none" stroke="${main}" stroke-width="8" /><path d="m94 64-9 30-27 10 9-30 27-10Z" fill="none" stroke="${main}" stroke-width="7" stroke-linejoin="round" />`,
    star: `<path d="M80 39l12 27 29 3-22 19 7 29-26-15-26 15 7-29-22-19 29-3 12-27Z" fill="none" stroke="${main}" stroke-width="8" stroke-linejoin="round" />`,
  };
  const iconScale = {
    exp: 0.82,
    level: 0.78,
    streak: 0.74,
    perfect: 0.82,
    accuracy: 0.86,
    "quiz-count": 0.72,
    "subject-quiz": 0.72,
    "subject-exp": 0.7,
    "subject-mastery": 0.64,
  }[kind] || 1;
  const iconYOffset = {
    level: -3,
    streak: 4,
    perfect: -4,
    "quiz-count": 16,
    "subject-quiz": 22,
    "subject-exp": -2,
    "subject-mastery": 2,
  }[kind] || 0;
  const iconMark = `<g transform="translate(80 ${80 + iconYOffset}) scale(${iconScale}) translate(-80 -80)">${symbols[icon] || symbols.star}</g>`;
  const kindDetails = {
    exp: `<path d="M108 44l8-13 3 14 13 4-13 5-4 14-7-13-14-4 14-7Z" fill="${gold}" opacity="${active ? ".78" : ".3"}" />`,
    level: `<path d="M56 122h48" stroke="${gold}" stroke-width="5" stroke-linecap="round" opacity="${active ? ".8" : ".32"}" />`,
    streak: `<path d="M65 111c10 7 24 7 34 0" stroke="${main}" stroke-width="5" stroke-linecap="round" opacity="${active ? ".52" : ".22"}" />`,
    "quiz-count": `<circle cx="112" cy="111" r="13" fill="${main}" opacity="${active ? ".86" : ".34"}" /><path d="M106 111l5 5 10-12" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".95" />`,
    "subject-quiz": `<circle cx="112" cy="106" r="13" fill="${main}" opacity="${active ? ".86" : ".34"}" /><path d="M106 106l5 5 10-12" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".95" />`,
    "subject-mastery": `<circle cx="111" cy="104" r="13" fill="${main}" opacity="${active ? ".86" : ".34"}" /><path d="M111 96l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z" fill="#ffffff" opacity=".95" />`,
  };
  return `
    <svg class="achievement-icon tier-${tier} kind-${kind} ${active ? "" : "locked"}" viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <linearGradient id="${gradientId}" x1="28" y1="24" x2="132" y2="138" gradientUnits="userSpaceOnUse">
          <stop stop-color="${main}" />
          <stop offset=".62" stop-color="${isPurple ? "#7c69d1" : "#39a66f"}" />
          <stop offset="1" stop-color="${gold}" />
        </linearGradient>
      </defs>
      ${kindFrames[kind] || tierFrames[tier] || tierFrames.starter}
      ${pips}
      ${iconMark}
      ${kindDetails[kind] || ""}
      ${(tier === "starter" || tier === "solid") && !["quiz-count", "subject-quiz", "subject-exp", "subject-mastery", "perfect"].includes(kind) ? `<path d="M52 130h56l-11 18-17-10-17 10-11-18Z" fill="${main}" opacity="${active ? ".94" : ".28"}" />` : ""}
      ${tier === "legendary" ? `<circle cx="80" cy="84" r="8" fill="${ink}" opacity="${active ? ".08" : ".04"}" />` : ""}
    </svg>
  `;
}

function renderAchievementBoard(badges, { compact = false, admin = false } = {}) {
  const unlocked = badges.filter((badge) => badge.unlocked).length;
  const categories = [...new Set(badges.map((badge) => badge.category || "Badges"))];
  const renderBadgeCard = (badge) => `
    <article class="achievement-badge tier-${getBadgeTier(badge)} kind-${getBadgeVisualKind(badge)} ${badge.unlocked || admin ? "" : "locked"}">
      ${renderBadgeIcon(badge, { preview: admin })}
      <div>
        <strong>${escapeHtml(badge.title)}</strong>
        <p>${escapeHtml(badge.thai)} · ${escapeHtml(badge.description)}</p>
        <small>${admin ? escapeHtml(badge.requirement) : badge.unlocked ? "ปลดล็อกแล้ว" : `ความคืบหน้า ${escapeHtml(badge.progressText)}`}</small>
      </div>
    </article>
  `;
  return `
    <section class="achievement-board ${compact ? "compact" : ""}">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">${admin ? "Badge catalog" : "Achievement badges"}</p>
          <h2>${admin ? "เหรียญที่นักเรียนปลดล็อกได้" : "เหรียญความสำเร็จ"}</h2>
        </div>
        <span>${admin ? `${badges.length} badges` : `${unlocked}/${badges.length}`}</span>
      </div>
      <div class="achievement-groups">
        ${categories
          .map((category) => {
            const categoryBadges = badges.filter((badge) => (badge.category || "Badges") === category);
            const categoryUnlocked = categoryBadges.filter((badge) => badge.unlocked).length;
            return `
              <section class="achievement-category">
                <div class="achievement-category-head">
                  <strong>${escapeHtml(category)}</strong>
                  <span>${admin ? categoryBadges.length : `${categoryUnlocked}/${categoryBadges.length}`}</span>
                </div>
                <div class="achievement-grid">
                  ${categoryBadges.map(renderBadgeCard).join("")}
                </div>
              </section>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function normalizeSearch(value = "") {
  return String(value || "")
    .toLocaleLowerCase("th-TH")
    .trim();
}

function matchesTopic(item, query = "") {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const subject = getSubject(item.subject);
  const questionText = (item.questions || [])
    .map((question) => `${question.prompt || ""} ${(question.choices || []).map((choice) => choice.label || "").join(" ")}`)
    .join(" ");
  const text = normalizeSearch(
    [item.title, item.description, item.detailText, item.type, subject.id, subject.label, subject.short, subject.description, questionText].join(" "),
  );
  return tokens.every((token) => text.includes(token));
}

function getRouteParams() {
  return new URLSearchParams(state.route.split("?")[1] || "");
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function pageShell(content) {
  const isHome = state.route.split("?")[0] === "/";
  const isAdmin = state.user?.role === "admin";
  const accountLabel = state.user ? `บัญชีของ ${state.user.displayName || state.user.email}` : "เข้าสู่ระบบเพื่อเก็บ EXP";
  const accountNav = state.user ? "/profile" : "/login";
  return `
    <button class="account-corner" type="button" data-nav="${accountNav}" aria-label="${escapeHtml(accountLabel)}" title="${escapeHtml(accountLabel)}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>
    ${
      isHome
        ? ""
        : `<header class="site-nav">
            <button class="site-logo" type="button" data-nav="/" aria-label="กลับหน้าแรก">
              <img src="/assets/generated/kvisdom-logo.png" alt="KVISDOM" />
            </button>
            <nav class="site-links" aria-label="KVISdom navigation">
              <button type="button" data-nav="/">เรียน</button>
              <button type="button" data-nav="/results">EXP</button>
              ${isAdmin ? `<button type="button" data-nav="/admin">Creator</button>` : ""}
              ${isAdmin ? `<button type="button" data-nav="/admin/quizzes/new">+ Quick quiz</button>` : ""}
              ${isAdmin ? `<button type="button" data-nav="/admin/content/new?type=clip">+ คลิป</button>` : ""}
              ${isAdmin ? `<button type="button" data-nav="/admin/content/new?type=fact">+ เกร็ดวิทย์</button>` : ""}
            </nav>
          </header>`
    }
    ${state.message ? `<div class="toast">${state.message}</div>` : ""}
    ${content}
  `;
}

function learningStats(quizzes, attempts, contentItems) {
  const completed = attempts.length;
  const exp = totalAttemptExp(attempts);
  const progress = getExpProgress(exp);
  const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0), 0);
  const quizCount = quizzes.length;
  return `
    <section class="status-board" aria-label="สถานะการเรียน">
      <article class="level-card">
        <span>Lv.${progress.level}</span>
        <p>${progress.currentLevelExp}/${progress.nextLevelExp} EXP</p>
        <div class="mini-exp-track"><i style="width: ${progress.percent}%"></i></div>
      </article>
      <article><span>${exp}</span><p>EXP สะสม</p></article>
      <article><span>${completed}</span><p>ควิซที่ทำแล้ว</p></article>
      <article><span>${bestScore}%</span><p>รอบที่ดีที่สุด</p></article>
      <article><span>${quizCount + contentItems.length}</span><p>บทเรียนที่เปิดอยู่</p></article>
    </section>
  `;
}

async function homePage() {
  const [quizzes, attempts, contentItems] = await Promise.all([store.listQuizzes(), store.listAttempts(), store.listContent()]);
  const totalExp = totalAttemptExp(attempts);
  const expProgress = getExpProgress(totalExp);
  const badges = getAchievementBadges(attempts);
  const unlockedBadges = badges.filter((badge) => badge.unlocked).length;
  return pageShell(`
    <main class="landing unified-home">
      <section class="brand-hero">
        <div class="brand-copy">
          <p class="academy-line">สร้างมาเพื่อจุดไอเดียใฝ่รู้</p>
          <h1 class="kvisdom-logo">K-VISdom</h1>
          <p class="brand-subtitle">
            แพลตฟอร์มรวมคลังความรู้ แบบฝึกหัด และควิซคุณภาพสูงจากนักเรียน KVIS
            สำหรับคนที่อยากเติบโตอย่างมีระบบ
          </p>
          <p class="hero-quote">ยิ่งส่งต่อ ความรู้ก็จะยิ่งทวีคูณ</p>
          <form data-form="topic-search" class="hero-search">
            <input name="q" placeholder="ค้นหา osmosis, แรงเสียดทาน, exponential..." aria-label="ค้นหาหัวข้อ" />
            <button type="submit">ค้นหา</button>
          </form>
          <div class="hero-actions">
            <button class="start-button" type="button" data-action="start-study">เริ่มฝึกฝน</button>
            <button type="button" data-nav="/quizzes">สำรวจคลังความรู้</button>
            ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin">ไป Creator</button>` : ""}
          </div>
          <div class="hero-mini-board">
            <span>${quizzes.length + contentItems.length} บทเรียน</span>
            <span>Lv.${expProgress.level} · ${totalExp} EXP</span>
            <span>${unlockedBadges}/${badges.length} badges</span>
          </div>
        </div>
        <div class="home-subject-panel" aria-label="วิชาหลักใน KVISdom">
          <div class="home-subject-head">
            <p class="eyebrow">เลือกวิชา</p>
            <h2>วันนี้อยากฝึกวิชาไหน?</h2>
          </div>
          ${SUBJECTS.map(
            (subject) => {
              const quizCount = quizzes.filter((quiz) => quiz.subject === subject.id).length;
              const contentCount = contentItems.filter((item) => item.subject === subject.id).length;
              return `
              <button type="button" class="home-subject-card" data-nav="/subject/${subject.id}" style="--subject: ${subject.accent}">
                <span>${subject.short}</span>
                <strong>${subject.label}</strong>
                <small>${quizCount} ควิซ · ${contentCount} สื่อเรียนรู้</small>
              </button>
            `;
            },
          ).join("")}
        </div>
      </section>
    </main>
  `);
}

async function subjectsPage() {
  const [quizzes, attempts, contentItems] = await Promise.all([store.listQuizzes(), store.listAttempts(), store.listContent()]);
  const recommended = getRecommendedSubject(quizzes, attempts, contentItems);
  return pageShell(`
    <main class="study-home">
      <section class="study-hero">
        <div>
        <p class="eyebrow">เลือกวิชา</p>
          <h1>วันนี้อยากฝึกวิชาไหน?</h1>
          <p>เลือกวิชาก่อน แล้ว KVISdom จะพาไปยังควิซ คลิป และเกร็ดวิทย์ของวิชานั้นโดยตรง</p>
        </div>
      </section>
      ${learningStats(quizzes, attempts, contentItems)}
      ${recommendedSubjectCard(recommended)}
      <section class="subject-grid subject-select-grid">
        ${SUBJECTS.map((subject) => subjectSelectionCard(subject, quizzes, contentItems)).join("")}
      </section>
    </main>
  `);
}

function getRecommendedSubject(quizzes, attempts, contentItems) {
  const attemptedQuizIds = new Set(attempts.map((attempt) => attempt.quizId));
  const subjectScores = SUBJECTS.map((subject) => {
    const nextQuiz = quizzes.find((quiz) => quiz.subject === subject.id && !attemptedQuizIds.has(quiz.id));
    const clip = contentItems.find((item) => item.subject === subject.id && item.type === "clip");
    const totalItems = quizzes.filter((quiz) => quiz.subject === subject.id).length + contentItems.filter((item) => item.subject === subject.id).length;
    const attemptsInSubject = attempts.filter((attempt) => attempt.subject === subject.id).length;
    return { subject, nextQuiz, clip, totalItems, attemptsInSubject };
  });
  return subjectScores.sort((a, b) => Number(Boolean(b.nextQuiz)) - Number(Boolean(a.nextQuiz)) || a.attemptsInSubject - b.attemptsInSubject || b.totalItems - a.totalItems)[0];
}

function recommendedSubjectCard(recommendation) {
  if (!recommendation) return "";
  const { subject, nextQuiz, clip, totalItems } = recommendation;
  return `
    <section class="next-action-card" style="--subject: ${subject.accent}">
      <div>
        <p class="eyebrow">แนะนำต่อไป</p>
        <h2>${nextQuiz ? `ลองควิซถัดไปใน${subject.label}` : `เริ่มจาก${subject.label}`}</h2>
        <p>${displayText(nextQuiz?.description || clip?.description, `${totalItems} บทเรียนรออยู่ในวิชานี้`)}</p>
      </div>
      <button type="button" class="primary" data-nav="${nextQuiz ? `/quiz/${nextQuiz.id}` : `/subject/${subject.id}`}">${nextQuiz ? "เริ่มควิซ" : "เข้าเรียน"}</button>
    </section>
  `;
}

function subjectSelectionCard(subject, quizzes, contentItems) {
  const quizCount = quizzes.filter((quiz) => quiz.subject === subject.id).length;
  const contentCount = contentItems.filter((item) => item.subject === subject.id).length;
  return `
    <article class="subject-card subject-select-card" style="--subject: ${subject.accent}">
      <span>${subject.short}</span>
      <h2>${subject.label}</h2>
      <p>${quizCount} ควิซ · ${contentCount} สื่อเรียนรู้</p>
      <button type="button" class="primary" data-nav="/subject/${subject.id}">เข้าเรียนวิชานี้</button>
    </article>
  `;
}

async function subjectStudyPage(subjectId) {
  const subject = getSubject(subjectId);
  const [quizzes, attempts, contentItems] = await Promise.all([store.listQuizzes(), store.listAttempts(), store.listContent()]);
  const subjectQuizzes = quizzes.filter((quiz) => quiz.subject === subject.id && !quiz.contentId);
  const subjectContent = contentItems.filter((item) => item.subject === subject.id);
  const subjectAttempts = attempts.filter((attempt) => attempt.subject === subject.id);
  const subjectExp = totalAttemptExp(subjectAttempts);
  const activeType = getActiveContentType();
  const topicQuery = getRouteParams().get("q") || "";
  const filteredQuizzes = subjectQuizzes.filter((quiz) => matchesTopic(quiz, topicQuery));
  const filteredContent = subjectContent.filter((item) => matchesTopic(item, topicQuery));
  const visibleQuizzes = activeType === "quiz" ? filteredQuizzes : [];
  const visibleContent = filteredContent.filter((item) => item.type === activeType);
  const visibleTextContent = visibleContent.filter((item) => !isPreviewMedia(item));
  const activeMeta = CONTENT_FILTERS.find((type) => type.id === activeType) || CONTENT_FILTERS[0];
  const subjectNext = getSubjectNextAction(subject, subjectQuizzes, subjectContent, subjectAttempts);
  return pageShell(`
    <main class="subject-room" style="--subject: ${subject.accent}">
      <section class="subject-top-grid">
        <section class="subject-overview">
          <div class="subject-title-row">
            <button type="button" class="back-link" data-nav="/">← เลือกวิชา</button>
            <span class="subject-accent-label">${subject.short}</span>
          </div>
          <div class="subject-main-row">
            <div>
              <h1>${subject.label}</h1>
              <p>เลือกควิซ คลิป หรือเกร็ดวิทย์ของวิชานี้</p>
            </div>
            <div class="subject-mini-stats">
              <span><strong>${subjectExp}</strong> EXP</span>
              <span><strong>${subjectAttempts.length}</strong> ควิซที่ทำแล้ว</span>
              <span><strong>${subjectQuizzes.length + subjectContent.length}</strong> บทเรียน</span>
            </div>
          </div>
        </section>
        ${subjectNextActionCard(subjectNext)}
      </section>
      <section class="learning-workspace">
        ${topicSearchPanel({ query: topicQuery, subjectId: subject.id, activeType, scope: "subject" })}
        <div class="content-tabs" role="tablist" aria-label="ประเภทบทเรียน">
          ${CONTENT_FILTERS.map((type) => contentTab(type, subject.id, activeType, filteredQuizzes, filteredContent, topicQuery)).join("")}
        </div>
        <section class="active-learning-panel" style="--mode: ${activeMeta.accent}">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">${activeMeta.label || "เส้นทางเรียน"}</p>
              <h2>${activeMeta.thai}</h2>
            </div>
            <span>${visibleQuizzes.length + visibleContent.length} รายการ</span>
          </div>
          ${activeType === "clip" || activeType === "fact" ? mediaPreviewSection(visibleContent, subject.id, activeType) : ""}
          <section class="lesson-list">
            ${
              visibleQuizzes.length
                ? visibleQuizzes.map(renderLessonQuiz).join("")
                : activeType === "quiz"
                  ? emptyMini(topicQuery ? "ไม่พบ Quick quiz ที่ตรงกับคำค้นนี้" : "ยังไม่มี Quick quiz ของวิชานี้", subject.id, "quiz")
                  : ""
            }
            ${visibleTextContent.length ? visibleTextContent.map(renderLessonContent).join("") : ""}
          </section>
        </section>
      </section>
    </main>
  `);
}

function studySequenceStrip(subject, quizzes, contentItems) {
  const clips = contentItems.filter((item) => item.type === "clip");
  const facts = contentItems.filter((item) => item.type === "fact");
  const steps = [
    {
      label: "ดูคลิป",
      title: clips.length ? "เริ่มจากคลิป" : "รอคลิปจากทีม",
      meta: clips.length ? `${clips.length} คลิปพร้อมดู` : "ยังไม่มีคลิป",
      nav: `/subject/${subject.id}?type=clip`,
      enabled: clips.length,
    },
    {
      label: "ทำควิซ",
      title: quizzes.length ? "ลองทำควิซ" : "รอควิซ",
      meta: quizzes.length ? `${quizzes.length} ควิซให้ฝึก` : "ยังไม่มีควิซ",
      nav: `/subject/${subject.id}?type=quiz`,
      enabled: quizzes.length,
    },
    {
      label: "ต่อยอด",
      title: facts.length ? "ต่อด้วยเกร็ดวิทย์" : "รอเกร็ดวิทย์",
      meta: facts.length ? `${facts.length} เรื่องเสริม` : "ยังไม่มีเรื่องเสริม",
      nav: `/subject/${subject.id}?type=fact`,
      enabled: facts.length,
    },
  ];

  return `
    <section class="study-sequence-strip" aria-label="ลำดับการเรียนแนะนำ">
      ${steps
        .map(
          (step, index) => `
            <button
              type="button"
              class="sequence-step ${step.enabled ? "" : "disabled"}"
              ${step.enabled ? `data-nav="${step.nav}"` : "disabled"}
            >
              <span>${index + 1}</span>
              <strong>${step.label}</strong>
              <small>${step.title}</small>
              <em>${step.meta}</em>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function getSubjectNextAction(subject, quizzes, contentItems, attempts) {
  const attemptedQuizIds = new Set(attempts.map((attempt) => attempt.quizId));
  const nextQuiz = quizzes.find((quiz) => !attemptedQuizIds.has(quiz.id));
  const clip = contentItems.filter((item) => item.type === "clip").sort(contentQualitySort)[0];
  const fact = contentItems.find((item) => item.type === "fact");
  return {
    subject,
    title: nextQuiz ? "ควิซถัดไปที่ควรทำ" : clip ? "เริ่มด้วยคลิปสั้น" : fact ? "อ่านเกร็ดวิทย์ก่อน" : "เลือกบทเรียน",
    description: nextQuiz?.description || clip?.description || fact?.description || "เลือกจากควิซ คลิป หรือเกร็ดวิทย์ด้านล่าง",
    action: nextQuiz ? "ทำควิซนี้" : clip ? "ดูคลิป" : "ดูบทเรียน",
    nav: nextQuiz ? `/quiz/${nextQuiz.id}` : clip ? `/content/${clip.id}` : `/subject/${subject.id}`,
  };
}

async function contentLessonPage(contentId) {
  const [item, quizzes] = await Promise.all([
    store.getContent(contentId),
    store.listQuizzes({ includeDrafts: state.user?.role === "admin" }),
  ]);
  if (!item) {
    return pageShell(`
      <main class="empty-state route-empty-state">
        <p class="eyebrow">Not found</p>
        <h1>ไม่พบสื่อนี้</h1>
        <p>สื่อนี้อาจยังไม่เผยแพร่ หรือถูกลบไปแล้ว</p>
        <button class="primary" type="button" data-nav="/">กลับหน้าแรก</button>
      </main>
    `);
  }

  const subject = getSubject(item.subject);
  const type = getContentType(item.type);
  const youtubeId = getYouTubeId(item.url);
  const coverUrl = getMediaCoverUrl(item);
  const drivePreviewUrl = getGoogleDrivePreviewUrl(item.url);
  const practiceQuizzes = quizzes.filter((quiz) => quiz.contentId === item.id && (state.user?.role === "admin" || quiz.status === "published"));
  return pageShell(`
    <main class="content-lesson-page" style="--subject: ${subject.accent}; --mode: ${type.accent}">
      <section class="content-lesson-hero">
        <div>
          <button type="button" class="back-link" data-nav="/subject/${subject.id}${item.type === "clip" ? "?type=clip" : "?type=fact"}">← ${subject.label}</button>
          <p class="eyebrow">${type.thai}</p>
          <h1>${escapeHtml(item.title)}</h1>
          <p>${escapeHtml(item.description)}</p>
        </div>
        <span class="subject-accent-label">${subject.short}</span>
      </section>
      <section class="content-lesson-layout">
        <article class="lesson-player-card">
          ${
            item.type === "fact"
              ? drivePreviewUrl
                ? renderGoogleDriveFrame(drivePreviewUrl, item.title)
                : renderFactHeroPoster(item)
              : youtubeId
              ? renderYouTubeFrame(youtubeId, item.title)
              : renderMediaThumb({ coverUrl, title: item.title, type: item.type })
          }
          <div class="lesson-player-meta">
            <span class="lesson-kind">${type.thai}</span>
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.description)}</p>
          </div>
          ${
            item.type === "fact" && item.detailText
              ? `<section class="fact-detail-panel">
                  <p class="eyebrow">ข้อมูลเพิ่มเติม</p>
                  <h2>อ่านต่อจากเกร็ดวิทย์</h2>
                  <p>${escapeHtml(item.detailText).replaceAll("\n", "<br>")}</p>
                </section>`
              : ""
          }
        </article>
        ${renderDownloadSidebar(item, subject, practiceQuizzes)}
      </section>
    </main>
  `);
}

function renderDownloadSidebar(item, subject, practiceQuizzes = []) {
  const fileName = item.resourceFileName || "";
  const fileUrl = item.resourceFileUrl || "";
  const isHostedUpload = fileUrl.startsWith("data:");
  const resourceLabel = fileName || (isGoogleDriveUrl(fileUrl) ? "Google Drive" : "ไฟล์ประกอบ");
  return `
    <aside class="lesson-download-sidebar">
      <section class="download-panel">
        <p class="eyebrow">ไฟล์ประกอบ</p>
        <h2>ดาวน์โหลดไฟล์</h2>
        <p>${item.type === "fact" ? "เก็บรูป สรุป หรือ worksheet สั้น ๆ ไว้คู่กับเกร็ดวิทย์ เพื่อให้นักเรียนอ่านต่อได้ในหน้าเดียว" : "เก็บ worksheet, PDF, slide หรือรูปประกอบไว้คู่กับคลิป เพื่อให้นักเรียนเรียนต่อได้ในหน้าเดียว"}</p>
        ${
          fileUrl
            ? isHostedUpload
              ? `<a class="download-button" href="${escapeHtml(fileUrl)}" download="${escapeHtml(fileName || `${item.title}-resource`)}">ดาวน์โหลด ${escapeHtml(resourceLabel)}</a>`
              : `<a class="download-button" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">เปิด ${escapeHtml(resourceLabel)}</a>`
            : `<div class="download-empty"><strong>ยังไม่มีไฟล์ประกอบ</strong><span>${state.user?.role === "admin" ? "เพิ่มไฟล์ได้จากหน้าแก้ไขสื่อ" : item.type === "fact" ? "ตอนนี้ดูเกร็ดวิทย์ได้ก่อน เมื่อทีมเพิ่มไฟล์จะดาวน์โหลดได้ตรงนี้" : "ตอนนี้ดูคลิปได้ก่อน เมื่อทีมเพิ่มไฟล์จะดาวน์โหลดได้ตรงนี้"}</span></div>`
        }
        <button type="button" data-nav="/subject/${subject.id}${item.type === "clip" ? "?type=clip" : "?type=fact"}">กลับไปบทเรียนวิชานี้</button>
        ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin/content/${item.id}/edit">แก้ไขสื่อนี้</button>` : ""}
      </section>
      <section class="download-panel practice-panel">
        <p class="eyebrow">โจทย์ฝึก</p>
        <h2>ทำโจทย์รับ EXP</h2>
        <p>โจทย์ชุดนี้ผูกกับ${item.type === "fact" ? "เกร็ดวิทย์" : "คลิป"}นี้โดยตรง นักเรียนดูสื่อแล้วฝึกต่อได้ทันที</p>
        ${
          practiceQuizzes.length
            ? `<div class="practice-list">${practiceQuizzes
                .map(
                  (quiz) => `
                    <article>
                      <div>
                        <strong>${escapeHtml(displayText(quiz.title, "โจทย์ฝึก"))}</strong>
                        <span>${quiz.questions?.length || 0} ข้อ · ${scoreToExp((quiz.questions || []).reduce((total, question) => total + Number(question.points || 0), 0))} EXP</span>
                      </div>
                      <button type="button" data-nav="/quiz/${escapeHtml(quiz.id)}">ทำโจทย์</button>
                    </article>
                  `,
                )
                .join("")}</div>`
            : `<div class="download-empty"><strong>ยังไม่มีโจทย์</strong><span>${state.user?.role === "admin" ? "สร้างโจทย์เพื่อให้นักเรียนเก็บ EXP หลังดูสื่อ" : "ทีม Creator ยังไม่ได้เพิ่มโจทย์ให้สื่อนี้"}</span></div>`
        }
        ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin/quizzes/new?contentId=${escapeHtml(item.id)}">+ สร้างโจทย์</button>` : ""}
      </section>
    </aside>
  `;
}

function contentQualitySort(a, b) {
  const score = (item) => Number(Boolean(getMediaCoverUrl(item))) * 2 + Number(Boolean(getYouTubeId(item.url) || getGoogleDrivePreviewUrl(item.url))) + Number(item.id?.startsWith("clip-"));
  return score(b) - score(a);
}

function subjectNextActionCard(next) {
  return `
    <section class="next-action-card compact" style="--subject: ${next.subject.accent}">
      <div>
        <p class="eyebrow">ขั้นถัดไป</p>
        <h2>${next.title}</h2>
        <p>${next.description}</p>
      </div>
      <button type="button" class="primary" data-nav="${next.nav}">${next.action}</button>
    </section>
  `;
}

function getActiveContentType() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("type") || "clip";
  return CONTENT_FILTERS.some((type) => type.id === requested) ? requested : "clip";
}

function mediaPreviewSection(contentItems, subjectId = "biology", activeType = "all") {
  const mediaItems = contentItems.filter(isPreviewMedia).sort(contentQualitySort);
  const isFactOnly = activeType === "fact";
  const label = isFactOnly ? "เกร็ดวิทย์" : activeType === "clip" ? "คลิป" : "สื่อแนะนำ";
  const emptyTitle = isFactOnly ? "ยังไม่มีเกร็ดวิทย์ของวิชานี้" : "ยังไม่มีคลิปของวิชานี้";
  const emptyText = isFactOnly
    ? "เมื่อทีมเพิ่มวิดีโอ Google Drive นักเรียนจะเห็น preview และกดเปิดได้จากตรงนี้"
    : "เมื่อทีมเพิ่มคลิป นักเรียนจะเห็น preview และกดเปิดได้จากตรงนี้";
  if (!mediaItems.length) {
    return `
      <section class="video-preview empty-video-preview">
        <div>
          <span class="lesson-kind">${label}</span>
          <h2>${emptyTitle}</h2>
          <p>${emptyText}</p>
        </div>
        ${
          state.user?.role === "admin"
            ? `<button type="button" data-nav="/admin/content/new?subject=${subjectId}&type=${isFactOnly ? "fact" : "clip"}">${isFactOnly ? "เพิ่มเกร็ดวิทย์" : "เพิ่มคลิป"}</button>`
            : ""
        }
      </section>
    `;
  }

  if (isFactOnly) {
    return `
      <section class="fact-preview">
        <div class="video-preview-head">
          <span class="lesson-kind">${label}</span>
        <h2>วิดีโอเกร็ดวิทย์</h2>
        </div>
        <div class="fact-grid">
          ${mediaItems.map(renderFactCard).join("")}
        </div>
      </section>
    `;
  }

  return `
    <section class="video-preview">
      <div class="video-preview-head">
        <span class="lesson-kind">${label}</span>
        <h2>${isFactOnly ? "เปิดวิดีโอเกร็ดวิทย์" : "เริ่มจากสื่อสั้น"}</h2>
      </div>
      <div class="video-preview-grid">
        ${renderMediaPreview(mediaItems[0])}
        ${
          mediaItems.length > 1
            ? `<div class="video-more-list" aria-label="คลิปเพิ่มเติม">
                ${mediaItems.slice(1).map(renderCompactMediaItem).join("")}
              </div>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderFactCard(item) {
  const coverUrl = getMediaCoverUrl(item);
  const needsPreview = !coverUrl;
  return `
    <article class="fact-card ${needsPreview ? "needs-admin-fix" : ""}">
      ${renderMediaPoster({ coverUrl, title: item.title, type: item.type, positionStyle: coverPositionStyle(item) })}
      <div class="fact-card-body">
        <span class="lesson-kind">เกร็ดวิทย์</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        ${needsPreview && state.user?.role === "admin" ? `<small class="content-fix-note">เพิ่มภาพปกเพื่อให้ preview สวยขึ้น</small>` : ""}
        <div class="content-actions">
          ${renderContentPrimaryAction(item)}
          ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin/content/${item.id}/edit">แก้ไข</button>` : ""}
          ${state.user?.role === "admin" ? `<button type="button" class="danger-button" data-action="delete-content" data-content-id="${escapeHtml(item.id)}" data-delete-title="${escapeHtml(item.title)}">ลบ</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function isPreviewMedia(item) {
  return item?.type === "clip" || item?.type === "fact";
}

function renderMediaPreview(item) {
  const youtubeId = getYouTubeId(item.url);
  const coverUrl = getMediaCoverUrl(item);
  const needsCover = !coverUrl;
  return `
    <article class="video-card ${needsCover ? "needs-admin-fix" : ""}">
      ${renderMediaThumb({ coverUrl, youtubeId, title: item.title, type: item.type, positionStyle: coverPositionStyle(item) })}
      <div class="video-info">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        ${needsCover && state.user?.role === "admin" ? `<small class="content-fix-note">${item.type === "fact" ? "ควรเพิ่มภาพปกเพื่อให้ preview สวยขึ้น" : "ควรเพิ่ม YouTube video URL หรือภาพปกก่อนเผยแพร่จริง"}</small>` : ""}
        <div class="content-actions">
          ${renderContentPrimaryAction(item)}
          ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin/content/${item.id}/edit">แก้ไข</button>` : ""}
          ${state.user?.role === "admin" ? `<button type="button" class="danger-button" data-action="delete-content" data-content-id="${escapeHtml(item.id)}" data-delete-title="${escapeHtml(item.title)}">ลบ</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderCompactMediaItem(item) {
  const type = getContentType(item.type);
  const youtubeId = getYouTubeId(item.url);
  const coverUrl = getMediaCoverUrl(item);
  return `
    <article class="compact-video-item">
      <div class="compact-video-thumb">
        ${renderMediaPoster({ coverUrl, youtubeId, title: item.title, type: item.type, positionStyle: coverPositionStyle(item) })}
      </div>
      <div class="compact-video-body">
        <span class="lesson-kind">${type.thai}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.description)}</p>
      </div>
      <div class="content-actions">
        ${renderContentPrimaryAction(item)}
        ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin/content/${item.id}/edit">แก้ไข</button>` : ""}
        ${state.user?.role === "admin" ? `<button type="button" class="danger-button" data-action="delete-content" data-content-id="${escapeHtml(item.id)}" data-delete-title="${escapeHtml(item.title)}">ลบ</button>` : ""}
      </div>
    </article>
  `;
}

function renderContentPrimaryAction(item) {
  if (item.type === "clip") {
    return `<button type="button" class="primary" data-nav="/content/${escapeHtml(item.id)}">ดูคลิป</button>`;
  }
  if (item.type === "fact") {
    return `<button type="button" class="primary" data-nav="/content/${escapeHtml(item.id)}">ดูเกร็ดวิทย์</button>`;
  }
  return `<small>แสดงตัวอย่างเท่านั้น</small>`;
}

function getYouTubeId(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("/")[0] || "";
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) return parsed.searchParams.get("v") || "";
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || "";
    }
  } catch {
    return "";
  }
  return "";
}

function renderYouTubeFrame(youtubeId, title = "KVISdom video") {
  return `
    <div class="video-frame">
      <iframe
        src="https://www.youtube.com/embed/${escapeHtml(youtubeId)}"
        title="${escapeHtml(title)}"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    </div>
  `;
}

function renderGoogleDriveFrame(previewUrl, title = "KVISdom video") {
  return `
    <div class="video-frame drive-video-frame">
      <iframe
        src="${escapeHtml(previewUrl)}"
        title="${escapeHtml(title)}"
        loading="lazy"
        allow="autoplay; fullscreen"
        allowfullscreen
      ></iframe>
    </div>
  `;
}

function getYouTubeThumbnail(youtubeId) {
  return youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : "";
}

function getGoogleDriveFileId(url = "") {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return "";
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch?.[1]) return fileMatch[1];
    return parsed.searchParams.get("id") || "";
  } catch {
    return "";
  }
}

function getGoogleDrivePreviewUrl(url = "") {
  const fileId = getGoogleDriveFileId(url);
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : "";
}

function getGoogleDriveThumbnailUrl(url = "") {
  const fileId = getGoogleDriveFileId(url);
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200` : "";
}

function getMediaCoverUrl(item) {
  const customCover = item.thumbnailUrl || item.thumbnail_url || "";
  if (customCover) return customCover;
  const driveCover = getGoogleDriveThumbnailUrl(item.url);
  if (driveCover) return driveCover;
  return getYouTubeThumbnail(getYouTubeId(item.url));
}

function mediaActionLabel(item) {
  if (item.type === "clip") return "ดูคลิป";
  if (getGoogleDrivePreviewUrl(item.url)) return "ดูวิดีโอ";
  return "เปิดสื่อ";
}

function renderMediaThumb({ coverUrl = "", youtubeId = "", title = "KVISdom video", type = "clip", positionStyle = "" } = {}) {
  if (youtubeId) {
    return renderYouTubeFrame(youtubeId, title);
  }
  const missingText = type === "fact" ? "เพิ่มภาพปกเกร็ดวิทย์" : "เพิ่มลิงก์ YouTube หรือภาพปก";
  return `
    <div class="video-thumb ${coverUrl ? "has-cover" : "needs-cover"}">
      ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" ${positionStyle ? `style="${positionStyle}"` : ""} />` : ""}
      ${coverUrl ? "" : `<span class="cover-needed">${missingText}</span>`}
      ${coverUrl ? `<span class="play-mark">▶</span>` : ""}
    </div>
  `;
}

function renderMediaPoster({ coverUrl = "", youtubeId = "", title = "KVISdom video", type = "clip", positionStyle = "" } = {}) {
  const posterUrl = coverUrl || getYouTubeThumbnail(youtubeId);
  const missingText = type === "fact" ? "เพิ่มภาพปกเกร็ดวิทย์" : "เพิ่มภาพปกคลิป";
  return `
    <div class="video-thumb compact-poster ${posterUrl ? "has-cover" : "needs-cover"}">
      ${posterUrl ? `<img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)} preview" loading="lazy" ${positionStyle ? `style="${positionStyle}"` : ""} />` : `<span class="cover-needed">${missingText}</span>`}
      ${posterUrl || youtubeId ? `<span class="play-mark">▶</span>` : ""}
    </div>
  `;
}

function renderFactHeroPoster(item) {
  const coverUrl = getMediaCoverUrl(item);
  return `
    <div class="fact-hero-poster ${coverUrl ? "has-cover" : "needs-cover"}">
      ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(item.title)} preview" loading="lazy" style="${coverPositionStyle(item)}" />` : `<span class="cover-needed">เพิ่มภาพปกเพื่อให้หน้าเกร็ดวิทย์สวยขึ้น</span>`}
      <span class="fact-poster-badge">Google Drive</span>
    </div>
  `;
}

function clampPercent(value, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function coverPositionStyle(itemOrX = 50, y = 50) {
  const xValue = typeof itemOrX === "object" ? itemOrX.thumbnailPositionX : itemOrX;
  const yValue = typeof itemOrX === "object" ? itemOrX.thumbnailPositionY : y;
  return `object-position: ${clampPercent(xValue)}% ${clampPercent(yValue)}%`;
}

function isGoogleDriveUrl(url = "") {
  try {
    return new URL(url).hostname.includes("drive.google.com");
  } catch {
    return false;
  }
}

function getContentType(typeId) {
  return CONTENT_TYPES.find((candidate) => candidate.id === typeId) || CONTENT_TYPES[0];
}

function contentTab(type, subjectId, activeType, quizzes, contentItems, query = "") {
  const count =
    type.id === "quiz"
        ? quizzes.length
        : contentItems.filter((item) => item.type === type.id).length;
  const nav = `/subject/${subjectId}${buildQuery({ type: type.id, q: query })}`;
  return `
    <button
      role="tab"
      aria-selected="${activeType === type.id}"
      class="content-tab ${activeType === type.id ? "active" : ""}"
      style="--mode: ${type.accent}"
      type="button"
      data-nav="${nav}"
    >
      <span>${type.thai}</span>
      <strong>${count}</strong>
    </button>
  `;
}

function renderLessonQuiz(quiz) {
  const subject = getSubject(quiz.subject);
  const isPracticeSet = Boolean(quiz.contentId);
  return `
    <article class="lesson-row" style="--subject: ${subject.accent}">
      <span class="lesson-kind">${isPracticeSet ? "โจทย์" : "Quick quiz"}</span>
      <div>
        <h2>${quiz.title}</h2>
        <p>${quiz.description}</p>
      </div>
      <div class="lesson-meta">
        <small>${quiz.questions?.length || 0} ข้อ</small>
        <button type="button" class="primary" data-nav="/quiz/${quiz.id}">${isPracticeSet ? "ทำโจทย์" : "เริ่มทำ"}</button>
        ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin/quizzes/${quiz.id}/edit">แก้ไข</button>` : ""}
        ${state.user?.role === "admin" ? `<button type="button" class="danger-button" data-action="delete-quiz" data-quiz-id="${escapeHtml(quiz.id)}" data-delete-title="${escapeHtml(quiz.title)}">ลบ</button>` : ""}
      </div>
    </article>
  `;
}

function renderQuestionImage(question, compact = false) {
  const imageUrl = question.imageUrl || question.image_url || "";
  if (!imageUrl) return "";
  return `
    <figure class="question-image ${compact ? "compact" : ""}">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(question.imageAlt || question.image_alt || "ภาพประกอบคำถาม")}" loading="lazy" />
      ${question.imageAlt ? `<figcaption>${escapeHtml(question.imageAlt)}</figcaption>` : ""}
    </figure>
  `;
}

function renderLessonContent(item) {
  const type = getContentType(item.type);
  return `
    <article class="lesson-row" style="--subject: ${type.accent}">
      <span class="lesson-kind">${type.thai}</span>
      <div>
        <h2>${item.title}</h2>
        <p>${item.description}</p>
      </div>
      <div class="lesson-meta">
        <button type="button" data-nav="/content/${escapeHtml(item.id)}">${item.type === "fact" ? "ดูเกร็ดวิทย์" : "ดูคลิป"}</button>
        ${state.user?.role === "admin" ? `<button type="button" data-nav="/admin/content/${item.id}/edit">แก้ไข</button>` : ""}
        ${state.user?.role === "admin" ? `<button type="button" class="danger-button" data-action="delete-content" data-content-id="${escapeHtml(item.id)}" data-delete-title="${escapeHtml(item.title)}">ลบ</button>` : ""}
      </div>
    </article>
  `;
}

function renderQuizCard(quiz) {
  const subject = getSubject(quiz.subject);
  return `
    <article class="quiz-card" style="--subject: ${subject.accent}">
      <div class="card-line">
        <span class="subject-pill">${subject.label}</span>
        <span class="status-pill">${quiz.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</span>
      </div>
      <h2>${displayText(quiz.title)}</h2>
      <p>${displayText(quiz.description)}</p>
      <div class="card-line">
        <small>${quiz.questions?.length || 0} ข้อ</small>
        <button class="primary" type="button" data-nav="/quiz/${quiz.id}">ทำควิซ</button>
      </div>
    </article>
  `;
}

function renderContentCard(item) {
  const subject = getSubject(item.subject);
  const type = getContentType(item.type);
  return `
    <article class="resource-card" style="--subject: ${subject.accent}; --mode: ${type.accent}">
      <span>${type.thai}</span>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      ${item.type === "clip" ? `<button type="button" data-nav="/content/${escapeHtml(item.id)}">ดูคลิป</button>` : item.type === "fact" ? `<button type="button" data-nav="/content/${escapeHtml(item.id)}">ดูเกร็ดวิทย์</button>` : `<small>อ่านในห้องเรียน KVISdom</small>`}
    </article>
  `;
}

function emptyMini(text, subjectId = "biology", kind = "all") {
  const isAdmin = state.user?.role === "admin";
  const action =
    isAdmin && kind === "quiz"
      ? `<button class="primary" type="button" data-nav="/admin/quizzes/new">สร้าง Quick quiz</button>`
      : isAdmin && kind !== "quiz"
        ? `<button class="primary" type="button" data-nav="/admin/content/new?subject=${subjectId}&type=${kind === "fact" ? "fact" : "clip"}">${kind === "fact" ? "เพิ่มเกร็ดวิทย์" : "เพิ่มคลิป"}</button>`
        : `<button type="button" data-nav="/subject/${subjectId}?type=clip">ไปดูคลิป</button>`;
  return `
    <article class="empty-mini guided-empty">
      <div>
        <strong>${text}</strong>
        <p>${isAdmin ? "เพิ่มรายการใหม่เพื่อให้นักเรียนมีเส้นทางเรียนต่อเนื่อง" : "ลองเลือกคลิป Quick quiz หรือเกร็ดวิทย์จากแท็บด้านบน"}</p>
      </div>
      ${action}
    </article>
  `;
}

function adminTools(subjectId = "biology") {
  return `
    <aside class="admin-tools">
      <span>เครื่องมือ Creator</span>
      <button class="primary" type="button" data-nav="/admin/quizzes/new">สร้างควิซ</button>
      <button type="button" data-nav="/admin/content/new?subject=${subjectId}&type=clip">สร้างคลิป</button>
      <button type="button" data-nav="/admin/content/new?subject=${subjectId}&type=fact">สร้างเกร็ดวิทย์</button>
    </aside>
  `;
}

function authPage(mode) {
  if (state.user) {
    return pageShell(`
      <main class="auth-layout">
        <section class="auth-card signed-in-card">
          <p class="eyebrow">Already signed in</p>
          <h1>พร้อมเรียนต่อแล้ว</h1>
          <p>คุณเข้าสู่ระบบเป็น ${escapeHtml(state.user.displayName || state.user.email)} เลือกกลับไปเรียนต่อ หรือออกจากระบบเพื่อใช้บัญชีอื่น</p>
          <div class="empty-actions">
            <button class="primary" type="button" data-nav="/">ไปหน้าเลือกวิชา</button>
            ${needsOnboarding(state.user) ? `<button type="button" data-nav="/onboarding">ตั้งค่าโปรไฟล์</button>` : ""}
            ${state.user.role === "admin" ? `<button type="button" data-nav="/admin">ไป Creator</button>` : ""}
            <button type="button" data-action="sign-out">ออกจากระบบ</button>
          </div>
        </section>
      </main>
    `);
  }
  const isSignup = mode === "signup";
  const showEmailFallback = store.mode === "local";
  return pageShell(`
    <main class="auth-layout">
      <section class="auth-card auth-panel">
        <div class="auth-story">
          <p class="eyebrow">บัญชี KVISdom</p>
          <h1>${isSignup ? "สร้างบัญชี KVISdom" : "เข้าสู่ KVISdom"}</h1>
          <p>${isSignup ? "สร้างบัญชีอีเมลสำรองสำหรับกรณีที่ใช้ Google ไม่ได้ แล้วกลับมาเก็บ EXP และ badge ได้เหมือนเดิม" : "ใช้บัญชี Google เดียวเพื่อเลือกวิชา ดูคลิป ทำควิซ เก็บ EXP และกลับมาทบทวนเส้นทางเรียนของตัวเอง"}</p>
          <div class="auth-benefits" aria-label="สิ่งที่จะได้หลังเข้าสู่ระบบ">
            <span>เส้นทางวิชา</span>
            <span>ประวัติ EXP</span>
            <span>ประวัติการเรียน</span>
          </div>
        </div>
        <div class="auth-form-panel">
          ${
            isSignup
              ? `
                <div class="email-signup-card">
                  <p class="eyebrow">บัญชีสำรอง</p>
                  <h2>สร้างบัญชีด้วยอีเมล</h2>
                  <p>ใช้เมื่อยังไม่มี Google login หรืออยากมีทางเข้าสำรอง</p>
                  <form data-form="signup" class="form-stack">
                    <label>อีเมล<input name="email" type="email" required placeholder="you@example.com" /></label>
                    <label>รหัสผ่าน<input name="password" type="password" required minlength="6" placeholder="อย่างน้อย 6 ตัวอักษร" /></label>
                    <button class="primary" type="submit">สร้างบัญชี</button>
                  </form>
                  <button class="text-link-button" type="button" data-nav="/login">มีบัญชีอยู่แล้ว? กลับไปเข้าสู่ระบบ</button>
                </div>
              `
              : `
                <button class="google-auth-button" type="button" data-action="google-auth">
                  <svg class="google-mark" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285f4" d="M23.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.5c-.3 1.4-1.1 2.7-2.3 3.5v2.9h3.7c2.2-2 3.6-5 3.6-8.4Z" />
                    <path fill="#34a853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.1-4.2 1.1-3.1 0-5.8-2.1-6.7-5H1.5v3C3.5 21.9 7.4 24 12 24Z" />
                    <path fill="#fbbc05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3v-3H1.5C.5 8.3 0 10.1 0 12s.5 3.7 1.5 5.3l3.8-3Z" />
                    <path fill="#ea4335" d="M12 4.7c1.7 0 3.3.6 4.5 1.8L19.8 3C17.8 1.1 15.1 0 12 0 7.4 0 3.5 2.1 1.5 6.7l3.8 3C6.2 6.8 8.9 4.7 12 4.7Z" />
                  </svg>
                  เข้าสู่ระบบด้วย Google
                </button>
                <button class="guest-auth-button" type="button" data-nav="/">
                  เรียนแบบ Guest
                  <small>ดูบทเรียนได้ แต่ไม่เก็บ EXP หรือ badge</small>
                </button>
                <details class="email-auth-details" ${showEmailFallback ? "open" : ""}>
                  <summary>ใช้อีเมลแทน</summary>
                  <div class="auth-divider"><span>บัญชีอีเมลสำรอง</span></div>
                  <form data-form="email-auth" class="form-stack">
                    <label>อีเมล<input name="email" type="email" required placeholder="you@example.com" /></label>
                    <label>รหัสผ่าน<input name="password" type="password" required minlength="6" placeholder="อย่างน้อย 6 ตัวอักษร" /></label>
                    <div class="email-auth-actions">
                      <button class="primary" type="submit">เข้าสู่ระบบด้วยอีเมล</button>
                    </div>
                    <button class="text-link-button" type="button" data-nav="/forgot-password">ลืมรหัสผ่าน?</button>
                    <p class="email-signup-prompt">ยังไม่มีบัญชีอีเมล? <button type="button" data-nav="/signup">สร้างบัญชีด้วยอีเมล</button></p>
                  </form>
                  ${store.mode === "local" ? `<p class="helper">Demo student: student@kvisdom.local / kvisdom</p>` : ""}
                </details>
              `
          }
        </div>
      </section>
    </main>
  `);
}

function forgotPasswordPage() {
  return pageShell(`
    <main class="auth-layout">
      <section class="auth-card auth-panel">
        <div class="auth-story">
          <p class="eyebrow">ช่วยเหลือรหัสผ่าน</p>
          <h1>ลืมรหัสผ่าน?</h1>
          <p>กรอกอีเมลที่ใช้กับ KVISdom แล้วระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้</p>
        </div>
        <div class="auth-form-panel">
          <div class="email-signup-card">
            <p class="eyebrow">รีเซ็ตรหัสผ่าน</p>
            <h2>ขอลิงก์ตั้งรหัสผ่านใหม่</h2>
            <p>ถ้าอีเมลนี้มีบัญชีอยู่ คุณจะได้รับอีเมลสำหรับรีเซ็ตรหัสผ่าน</p>
            <form data-form="forgot-password" class="form-stack">
              <label>อีเมล<input name="email" type="email" required placeholder="you@example.com" /></label>
              <button class="primary" type="submit">ส่งอีเมลรีเซ็ตรหัสผ่าน</button>
            </form>
            <button class="text-link-button" type="button" data-nav="/login">กลับไปเข้าสู่ระบบ</button>
          </div>
        </div>
      </section>
    </main>
  `);
}

function resetPasswordPage() {
  return pageShell(`
    <main class="auth-layout">
      <section class="auth-card auth-panel">
        <div class="auth-story">
          <p class="eyebrow">รหัสผ่านใหม่</p>
          <h1>ตั้งรหัสผ่านใหม่</h1>
          <p>ใส่รหัสผ่านใหม่สำหรับบัญชี KVISdom ของคุณ แล้วกลับไปเรียนต่อได้ทันที</p>
        </div>
        <div class="auth-form-panel">
          <div class="email-signup-card">
            <p class="eyebrow">ความปลอดภัย</p>
            <h2>เลือกรหัสผ่านใหม่</h2>
            <p>ใช้รหัสผ่านอย่างน้อย 6 ตัวอักษร</p>
            <form data-form="reset-password" class="form-stack">
              <label>รหัสผ่านใหม่<input name="password" type="password" required minlength="6" placeholder="อย่างน้อย 6 ตัวอักษร" /></label>
              <label>ยืนยันรหัสผ่านใหม่<input name="confirmPassword" type="password" required minlength="6" placeholder="พิมพ์รหัสผ่านอีกครั้ง" /></label>
              <button class="primary" type="submit">บันทึกรหัสผ่านใหม่</button>
            </form>
            <button class="text-link-button" type="button" data-nav="/login">กลับไปเข้าสู่ระบบ</button>
          </div>
        </div>
      </section>
    </main>
  `);
}

function topicSearchPanel({ query = "", subjectId = "all", activeType = "all", scope = "global" } = {}) {
  const isSubjectScope = scope === "subject";
  return `
    <section class="topic-search-panel ${isSubjectScope ? "compact" : ""}">
      <form data-form="topic-search" data-scope="${scope}" data-subject-id="${escapeHtml(subjectId)}" class="topic-search-form">
        <input name="q" value="${escapeHtml(query)}" placeholder="ค้นหาหัวข้อ เช่น osmosis, แรงเสียดทาน, exponential" aria-label="ค้นหาหัวข้อ" />
        ${
          isSubjectScope
            ? `<input type="hidden" name="subject" value="${escapeHtml(subjectId)}" /><input type="hidden" name="type" value="${escapeHtml(activeType)}" />`
            : `<select name="subject" aria-label="เลือกวิชา">
                <option value="all">ทุกวิชา</option>
                ${SUBJECTS.map((subject) => `<option value="${subject.id}" ${subjectId === subject.id ? "selected" : ""}>${subject.label}</option>`).join("")}
              </select>
              <select name="type" aria-label="เลือกประเภท">
                <option value="all">ทุกประเภท</option>
                ${CONTENT_TYPES.map((type) => `<option value="${type.id}" ${activeType === type.id ? "selected" : ""}>${type.thai}</option>`).join("")}
              </select>`
        }
        <button class="primary" type="submit">ค้นหา</button>
        ${query ? `<button type="button" data-nav="${isSubjectScope ? `/subject/${subjectId}${buildQuery({ type: activeType })}` : "/search"}">ล้าง</button>` : ""}
      </form>
      ${
        isSubjectScope
          ? ""
          : `<div class="search-examples" aria-label="ตัวอย่างคำค้น">
              ${["osmosis", "แรงเสียดทาน", "exponential"].map((term) => `<button type="button" data-nav="/search?q=${encodeURIComponent(term)}">${term}</button>`).join("")}
            </div>`
      }
    </section>
  `;
}

function createSearchEntries(quizzes = [], contentItems = []) {
  return [
    ...quizzes.map((quiz) => ({
      ...quiz,
      type: "quiz",
      nav: `/quiz/${quiz.id}`,
      cta: "เริ่ม Quick quiz",
    })),
    ...contentItems.map((item) => ({
      ...item,
      nav: `/content/${item.id}`,
      cta: item.type === "clip" ? "ดูคลิป" : "ดูเกร็ดวิทย์",
    })),
  ];
}

function filterSearchEntries(entries, { query = "", subject = "all", type = "all" } = {}) {
  return entries.filter((entry) => {
    const subjectOk = !subject || subject === "all" || entry.subject === subject;
    const typeOk = !type || type === "all" || entry.type === type;
    return subjectOk && typeOk && matchesTopic(entry, query);
  });
}

function renderSearchResult(entry) {
  const subject = getSubject(entry.subject);
  const type = getContentType(entry.type);
  return `
    <article class="search-result-card" style="--subject: ${subject.accent}; --mode: ${type.accent}">
      <div class="card-line">
        <span class="subject-pill">${subject.label}</span>
        <span class="status-pill">${type.thai}</span>
      </div>
      <h2>${escapeHtml(entry.title)}</h2>
      <p>${escapeHtml(entry.description || entry.detailText || "ไม่มีคำอธิบาย")}</p>
      <button class="primary" type="button" data-nav="${entry.nav}">${entry.cta}</button>
    </article>
  `;
}

async function searchPage() {
  const params = getRouteParams();
  const query = params.get("q") || "";
  const subject = params.get("subject") || "all";
  const type = params.get("type") || "all";
  const [quizzes, contentItems] = await Promise.all([store.listQuizzes(), store.listContent()]);
  const entries = filterSearchEntries(createSearchEntries(quizzes, contentItems), { query, subject, type });
  return pageShell(`
    <main class="search-page">
      <section class="section-head page-head">
        <div>
          <p class="eyebrow">Search + filter</p>
          <h1>ค้นหาหัวข้อที่อยากฝึก</h1>
          <p>ค้นจากชื่อ คำอธิบาย รายละเอียด และคำถามใน Quick quiz</p>
        </div>
      </section>
      ${topicSearchPanel({ query, subjectId: subject, activeType: type })}
      <section class="search-results-head">
        <strong>${entries.length} รายการ</strong>
        <span>${query ? `ผลลัพธ์สำหรับ "${escapeHtml(query)}"` : "เลือกคำค้นหรือ filter เพื่อเริ่ม"}</span>
      </section>
      <section class="search-results-grid">
        ${entries.length ? entries.map(renderSearchResult).join("") : `<article class="empty-state empty-score-state"><p class="eyebrow">No result</p><h2>ยังไม่พบหัวข้อนี้</h2><p>ลองใช้คำที่กว้างขึ้น หรือเปลี่ยนวิชา/ประเภท</p></article>`}
      </section>
    </main>
  `);
}

async function onboardingPage() {
  if (!state.user) return authPage("login");
  const [quizzes, attempts, contentItems] = await Promise.all([store.listQuizzes(), store.listAttempts(), store.listContent()]);
  const recommended = getRecommendedSubject(quizzes, attempts, contentItems);
  const favoriteSubject = state.user.favoriteSubject || recommended?.subject?.id || "biology";
  const subject = getSubject(favoriteSubject);
  const firstName = state.user.firstName || state.user.displayName?.split(/\s+/)[0] || "";
  const lastName = state.user.lastName || state.user.displayName?.split(/\s+/).slice(1).join(" ") || "";
  return pageShell(`
    <main class="onboarding-page">
      <section class="onboarding-layout">
        <form data-form="onboarding" class="onboarding-card form-stack">
          <div>
            <p class="eyebrow">ตั้งค่าครั้งแรก</p>
            <h1>สร้างโปรไฟล์ผู้เรียน</h1>
            <p>กรอกข้อมูลสั้น ๆ เพื่อให้ KVISdom จำเส้นทางเรียน EXP และ badge ของคุณได้</p>
          </div>
          <div class="form-grid">
            <label>ชื่อ
              <input name="firstName" required value="${escapeHtml(firstName)}" placeholder="เช่น พลอย" />
            </label>
            <label>นามสกุล
              <input name="lastName" required value="${escapeHtml(lastName)}" placeholder="เช่น ใจดี" />
            </label>
            <label>โรงเรียน
              <input name="school" value="${escapeHtml(state.user.school || "")}" placeholder="เช่น KVIS" />
            </label>
            <label>วิชาที่ชอบ
              <select name="favoriteSubject">
                ${SUBJECTS.map((option) => `<option value="${option.id}" ${favoriteSubject === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </label>
          </div>
          <label>แนะนำตัวสั้น ๆ
            <textarea name="description" placeholder="เช่น ชอบชีววิทยา อยากฝึกควิซทุกสัปดาห์">${escapeHtml(state.user.description || "")}</textarea>
          </label>
          <label>เป้าหมายของคุณ
            <textarea name="learningGoal" placeholder="เช่น อยากเข้าใจฟิสิกส์ให้มั่นใจก่อนสอบ หรืออยากทำควิซทุกวัน">${escapeHtml(state.user.learningGoal || "")}</textarea>
          </label>
          <section>
            <p class="eyebrow">ออกแบบ avatar</p>
            ${renderAvatarPicker(state.user)}
          </section>
          <button class="primary" type="submit">บันทึกและเริ่มจาก${subject.label}</button>
        </form>
        <aside class="onboarding-preview" style="--subject: ${subject.accent}">
          <p class="eyebrow">วิชาเริ่มต้นที่แนะนำ</p>
          <h2>${subject.label}</h2>
          <p>${subject.description}</p>
          <div class="onboarding-subject-stats">
            <span>${quizzes.filter((quiz) => quiz.subject === subject.id).length} Quick quiz</span>
            <span>${contentItems.filter((item) => item.subject === subject.id).length} สื่อ</span>
          </div>
          <div class="onboarding-next">
            <strong>หลังจากบันทึก</strong>
            <p>ระบบจะพาไปหน้าวิชาที่เลือก และเริ่มเก็บ EXP จาก Quick quiz ได้ทันที</p>
          </div>
        </aside>
      </section>
    </main>
  `);
}

async function quizzesPage() {
  const params = getRouteParams();
  const query = params.get("q") || "";
  const subject = params.get("subject") || "all";
  const quizzes = filterSearchEntries(createSearchEntries(await store.listQuizzes(), []), { query, subject, type: "quiz" });
  return pageShell(`
    <main>
      <section class="section-head page-head">
        <div>
          <p class="eyebrow">คลังควิซ</p>
          <h1>ควิซที่เปิดให้ทำ</h1>
        </div>
        <button type="button" data-nav="/results">ดู EXP ของฉัน</button>
      </section>
      ${topicSearchPanel({ query, subjectId: subject, activeType: "quiz" })}
      <section class="quiz-grid">
        ${quizzes.length ? quizzes.map(renderQuizCard).join("") : `<article class="empty-state empty-score-state"><p class="eyebrow">No quiz</p><h2>ไม่พบ Quick quiz</h2><p>ลองค้นคำอื่น หรือกลับไปเลือกวิชา</p></article>`}
      </section>
    </main>
  `);
}

async function quizTakePage(quizId) {
  const quiz = await store.getQuiz(quizId);
  if (!quiz) return pageShell(`<main class="empty-state"><h1>ไม่พบควิซ</h1><button type="button" data-nav="/quizzes">กลับไปหน้าควิซ</button></main>`);
  const subject = getSubject(quiz.subject);
  const totalQuestions = quiz.questions.length;
  const maxScore = quiz.questions.reduce((total, question) => total + Number(question.points || 0), 0);
  const maxExp = scoreToExp(maxScore);
  const resultPercent = state.lastResult?.maxScore ? Math.round((state.lastResult.score / state.lastResult.maxScore) * 100) : 0;
  const resultTone = resultPercent >= 80 ? "ยอดเยี่ยม" : resultPercent >= 50 ? "กำลังดีขึ้น" : "ลองทบทวนอีกนิด";
  return pageShell(`
    <main class="quiz-take" style="--subject: ${subject.accent}">
      <section class="quiz-title-card">
        <div>
          <span class="subject-pill">${subject.label}</span>
          <h1>${quiz.title}</h1>
          <p>${quiz.description}</p>
        </div>
        <div class="quiz-title-meta">
          <span><strong>${totalQuestions}</strong> ข้อ</span>
          <span><strong>${maxExp}</strong> EXP</span>
        </div>
      </section>
      ${state.lastResult ? quizResultPanel(state.lastResult, resultPercent, resultTone, quiz, subject) : ""}
      <form data-form="submit-quiz" data-quiz-id="${quiz.id}" class="question-stack">
        <section class="quiz-progress-card">
          <div>
            <strong data-quiz-progress-text>${state.lastResult ? "ส่งคำตอบแล้ว" : `ตอบแล้ว 0/${totalQuestions}`}</strong>
            <span>${state.lastResult ? "ดูคำอธิบายและ EXP ที่ได้รับด้านล่าง" : "เลือกคำตอบให้ครบก่อนรับ EXP"}</span>
          </div>
          <div class="quiz-progress-track" aria-hidden="true">
            <span data-quiz-progress-fill style="width: ${state.lastResult ? "100" : "0"}%"></span>
          </div>
        </section>
        ${quiz.questions
          .map(
            (question, index) => `
              <article class="question-card">
                <div class="question-head">
                  <h2>${index + 1}. ${question.prompt}</h2>
                  <span>${scoreToExp(question.points)} EXP</span>
                </div>
                ${renderQuestionImage(question)}
                <div class="choice-list">
                  ${question.choices
                    .map(
                      (choice) => `
                        <label class="choice-row ${choiceResultClass(state.lastResult, question, choice)}">
                          <input type="radio" name="${question.id}" value="${choice.id}" required ${choiceChecked(state.lastResult, question, choice)} ${state.lastResult ? "disabled" : ""} />
                          <span>${choice.label}</span>
                        </label>
                      `,
                    )
                    .join("")}
                </div>
                ${state.lastResult ? resultForQuestion(state.lastResult, question) : ""}
              </article>
            `,
          )
          .join("")}
        ${
          state.lastResult
            ? ""
            : state.user
              ? `<button class="primary wide quiz-submit" type="submit" disabled>ตอบให้ครบก่อนรับ EXP</button>`
              : `<button class="primary wide quiz-submit guest-quiz-submit" type="button" data-nav="/login">เข้าสู่ระบบด้วย Google เพื่อรับ EXP</button>`
        }
      </form>
    </main>
  `);
}

function quizResultPanel(result, resultPercent, resultTone, quiz, subject) {
  const earnedExp = scoreToExp(result.score);
  const maxExp = scoreToExp(result.maxScore);
  return `
    <section class="score-panel">
      <p class="eyebrow">Quest clear</p>
      <div class="score-panel-main">
        <div class="score-ring" style="--score: ${resultPercent}">
          <strong>${resultPercent}%</strong>
          <span>${earnedExp}/${maxExp} EXP</span>
        </div>
        <div>
          <h2>${resultTone}</h2>
          <p>ได้รับ ${earnedExp} EXP แล้ว อ่านคำอธิบายข้อที่พลาด แล้วกลับไปเลือกบทเรียนต่อได้ทันที</p>
        </div>
      </div>
      <div class="score-actions">
        <button type="button" data-nav="/profile">ดูสถานะของฉัน</button>
        <button type="button" data-nav="/results">ดูประวัติ EXP</button>
        <button class="primary" type="button" data-nav="/subject/${quiz.subject}">กลับห้อง ${subject.label}</button>
      </div>
    </section>
  `;
}

function choiceChecked(result, question, choice) {
  const answer = result?.answers.find((item) => item.questionId === question.id);
  return answer?.selectedChoiceId === choice.id ? "checked" : "";
}

function choiceResultClass(result, question, choice) {
  const answer = result?.answers.find((item) => item.questionId === question.id);
  if (!answer) return "";
  if (answer.correctChoiceId === choice.id) return "correct-choice";
  if (answer.selectedChoiceId === choice.id && !answer.isCorrect) return "wrong-choice";
  return "muted-choice";
}

function resultForQuestion(result, question) {
  const answer = result.answers.find((item) => item.questionId === question.id);
  if (!answer) return "";
  return `
    <div class="answer-note ${answer.isCorrect ? "correct" : "wrong"}">
      <strong>${answer.isCorrect ? "ถูกต้อง" : "ยังไม่ใช่"}</strong>
      <p>${question.explanation || "กลับไปดูวิธีคิดแล้วลองใหม่ได้"}</p>
    </div>
  `;
}

async function resultsPage() {
  const attempts = await store.listAttempts();
  const totalExp = totalAttemptExp(attempts);
  const expProgress = getExpProgress(totalExp);
  const bestPercent = attempts.reduce((best, attempt) => Math.max(best, attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0), 0);
  const badges = getAchievementBadges(attempts);
  return pageShell(`
    <main>
      <section class="section-head page-head">
        <div>
          <p class="eyebrow">ประวัติ EXP</p>
          <h1>ประวัติ EXP</h1>
        </div>
        <button type="button" data-nav="/quizzes">ทำควิซเพิ่ม</button>
      </section>
      <section class="results-summary">
        <article><span>Lv.${expProgress.level}</span><p>เลเวลปัจจุบัน</p></article>
        <article><span>${totalExp}</span><p>EXP รวม</p></article>
        <article><span>${attempts.length}</span><p>ครั้งที่ทำควิซ</p></article>
        <article><span>${bestPercent}%</span><p>รอบที่ดีที่สุด</p></article>
      </section>
      ${renderAchievementBoard(badges, { compact: true })}
      <section class="results-list">
        ${
          attempts.length
            ? attempts
                .map((attempt) => {
                  const subject = getSubject(attempt.subject);
                  const percent = attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;
                  const exp = scoreToExp(attempt.score);
                  const maxExp = scoreToExp(attempt.maxScore);
                  return `
                    <article class="result-row" style="--subject: ${subject.accent}">
                      <span class="subject-dot"></span>
                      <div>
                        <strong>${attempt.quizTitle}</strong>
                        <p>${subject.label} · ${new Date(attempt.submittedAt).toLocaleString("th-TH")}</p>
                        <div class="result-progress"><span style="width: ${percent}%"></span></div>
                      </div>
                      <b>${exp}/${maxExp} EXP<small>${percent}%</small></b>
                    </article>
                  `;
                })
                .join("")
            : `<article class="empty-state empty-score-state">
                <p class="eyebrow">Ready for first quest</p>
                <h2>ยังไม่มี EXP</h2>
                <p>เลือกวิชาแรก ทำควิซสั้น ๆ แล้ว KVISdom จะเก็บ EXP และประวัติการเรียนไว้ให้กลับมาดูได้</p>
                <div class="empty-actions">
                  <button class="primary" type="button" data-nav="/">เลือกวิชา</button>
                  <button type="button" data-nav="/quizzes">ดูควิซทั้งหมด</button>
                </div>
              </article>`
        }
      </section>
    </main>
  `);
}

async function profilePage() {
  if (!state.user) return authPage("login");
  const [quizzes, attempts, contentItems] = await Promise.all([store.listQuizzes(), store.listAttempts(), store.listContent()]);
  const totalExp = totalAttemptExp(attempts);
  const progress = getExpProgress(totalExp);
  const bestPercent = attempts.reduce((best, attempt) => Math.max(best, attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0), 0);
  const completedQuizIds = new Set(attempts.map((attempt) => attempt.quizId));
  const completedSubjects = new Set(attempts.map((attempt) => attempt.subject)).size;
  const nextQuiz = quizzes.find((quiz) => !completedQuizIds.has(quiz.id));
  const recentAttempts = attempts.slice(0, 4);
  const badges = getAchievementBadges(attempts);
  const unlockedBadges = badges.filter((badge) => badge.unlocked).length;
  const firstName = state.user.firstName || state.user.displayName?.split(/\s+/)[0] || "";
  const lastName = state.user.lastName || state.user.displayName?.split(/\s+/).slice(1).join(" ") || "";

  return pageShell(`
    <main class="profile-page">
      <section class="profile-shell">
        <article class="profile-player-card">
          <div class="profile-avatar">${renderAvatar(state.user, { compact: true })}</div>
          <div>
            <p class="eyebrow">สถานะผู้เรียน</p>
            <h1>${escapeHtml(state.user.displayName || "KVISdom Learner")}</h1>
            <p>${escapeHtml(state.user.school || "KVISdom")}</p>
            ${state.user.description ? `<p>${escapeHtml(state.user.description)}</p>` : ""}
            <div class="profile-badges">
              <span>${state.user.role === "admin" ? "Creator" : "ผู้เรียน"}</span>
              <span>แตะแล้ว ${completedSubjects || 0} วิชา</span>
              <span>${unlockedBadges}/${badges.length} badges</span>
            </div>
          </div>
        </article>
        <section class="profile-progress-card">
          <div class="level-emblem">
            <span>Level</span>
            <strong>${progress.level}</strong>
          </div>
          <div class="profile-exp-copy">
            <p class="eyebrow">EXP progress</p>
            <h2>${progress.currentLevelExp}/${progress.nextLevelExp} EXP</h2>
            <div class="exp-track" aria-hidden="true"><span style="width: ${progress.percent}%"></span></div>
            <p>${totalExp} EXP สะสมทั้งหมด · อีก ${progress.nextLevelExp - progress.currentLevelExp} EXP ถึง Lv.${progress.level + 1}</p>
          </div>
        </section>
      </section>
      <section class="profile-stat-grid" aria-label="สถานะผู้เรียน">
        <article><span>${attempts.length}</span><p>ควิซที่ทำแล้ว</p></article>
        <article><span>${bestPercent}%</span><p>รอบที่ดีที่สุด</p></article>
        <article><span>${completedSubjects}</span><p>วิชาที่แตะแล้ว</p></article>
        <article><span>${quizzes.length + contentItems.length}</span><p>บทเรียนที่เปิดอยู่</p></article>
      </section>
      ${renderAchievementBoard(badges)}
      <section class="profile-editor-card">
        <div>
          <p class="eyebrow">โปรไฟล์ผู้เรียน</p>
          <h2>แก้ไขข้อมูลของคุณ</h2>
          <p>เปลี่ยนชื่อ วิชาที่ชอบ เป้าหมาย และ avatar ได้ตลอดเวลา</p>
        </div>
        <form data-form="save-profile" class="profile-editor-form">
          <div class="form-grid">
            <label>ชื่อ
              <input name="firstName" required value="${escapeHtml(firstName)}" placeholder="เช่น พลอย" />
            </label>
            <label>นามสกุล
              <input name="lastName" required value="${escapeHtml(lastName)}" placeholder="เช่น ใจดี" />
            </label>
            <label>โรงเรียน
              <input name="school" value="${escapeHtml(state.user.school || "")}" placeholder="เช่น KVIS" />
            </label>
            <label>วิชาที่ชอบ
              <select name="favoriteSubject">
                ${SUBJECTS.map((option) => `<option value="${option.id}" ${state.user.favoriteSubject === option.id ? "selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </label>
          </div>
          <label>แนะนำตัวสั้น ๆ
            <textarea name="description" placeholder="เช่น ชอบชีววิทยา อยากฝึกควิซทุกสัปดาห์">${escapeHtml(state.user.description || "")}</textarea>
          </label>
          <label>เป้าหมายของคุณ
            <textarea name="learningGoal" placeholder="เช่น อยากเข้าใจฟิสิกส์ให้มั่นใจก่อนสอบ หรืออยากทำควิซทุกวัน">${escapeHtml(state.user.learningGoal || "")}</textarea>
          </label>
          ${renderAvatarPicker(state.user)}
          <button class="primary" type="submit">บันทึกโปรไฟล์</button>
        </form>
      </section>
      ${
        nextQuiz
          ? `<section class="next-action-card profile-next" style="--subject: ${getSubject(nextQuiz.subject).accent}">
              <div>
                <p class="eyebrow">Next quest</p>
                <h2>${escapeHtml(nextQuiz.title)}</h2>
                <p>${escapeHtml(nextQuiz.description)}</p>
              </div>
              <button class="primary" type="button" data-nav="/quiz/${nextQuiz.id}">เริ่มรับ EXP</button>
            </section>`
          : `<section class="next-action-card profile-next">
              <div>
                <p class="eyebrow">Quest board</p>
                <h2>ทำควิซที่เปิดอยู่ครบแล้ว</h2>
                <p>กลับไปเลือกคลิปหรือเกร็ดวิทย์ระหว่างรอควิซใหม่จากทีม Creator</p>
              </div>
              <button class="primary" type="button" data-nav="/">เลือกวิชา</button>
            </section>`
      }
      <section class="profile-history">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Recent quests</p>
            <h2>ประวัติล่าสุด</h2>
          </div>
          <button type="button" data-nav="/results">ดูทั้งหมด</button>
        </div>
        ${
          recentAttempts.length
            ? recentAttempts
                .map((attempt) => {
                  const subject = getSubject(attempt.subject);
                  const percent = attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;
                  return `
                    <article class="result-row" style="--subject: ${subject.accent}">
                      <span class="subject-dot"></span>
                      <div>
                        <strong>${escapeHtml(attempt.quizTitle)}</strong>
                        <p>${subject.label} · ${new Date(attempt.submittedAt).toLocaleString("th-TH")}</p>
                        <div class="result-progress"><span style="width: ${percent}%"></span></div>
                      </div>
                      <b>+${scoreToExp(attempt.score)} EXP<small>${percent}%</small></b>
                    </article>
                  `;
                })
                .join("")
            : `<article class="empty-state empty-score-state">
                <p class="eyebrow">No quest yet</p>
                <h2>ยังไม่มีประวัติ</h2>
                <p>เริ่มทำควิซแรกเพื่อเปิดสถานะ EXP ของคุณ</p>
                <button class="primary" type="button" data-nav="/">เลือกวิชา</button>
              </article>`
        }
      </section>
      <section class="profile-actions">
        <button type="button" data-nav="/">กลับไปเรียน</button>
        ${state.user.role === "admin" ? `<button type="button" data-nav="/admin">ไป Creator</button>` : ""}
        <button type="button" data-action="sign-out">ออกจากระบบ</button>
      </section>
    </main>
  `);
}

async function adminPage() {
  if (!state.user) return authPage("login");
  if (state.user.role !== "admin") {
    return pageShell(`
      <main class="auth-layout">
        <section class="auth-card admin-gate">
          <p class="eyebrow">Admin access</p>
          <h1>ปลดล็อกหน้าสร้างควิซ</h1>
          <p>ใส่รหัสแอดมินเพื่อเปิดเครื่องมือสร้างควิซ คลิป และเกร็ดวิทย์ของทีม KVISdom</p>
          <form data-form="claim-admin" class="form-stack">
            <label>Admin code<input name="code" type="password" required placeholder="KVISDOM-ADMIN" /></label>
            <button class="primary" type="submit">เข้าสู่โหมดแอดมิน</button>
          </form>
          <p class="helper">รหัสทดสอบสำหรับทีม: KVISDOM-ADMIN</p>
        </section>
      </main>
    `);
  }

  const [quizzes, contentItems] = await Promise.all([store.listQuizzes({ includeDrafts: true }), store.listContent({ includeDrafts: true })]);
  const polishItems = getCreatorPolishItems(quizzes, contentItems);
  return pageShell(`
    <main>
      <section class="section-head page-head">
        <div>
          <p class="eyebrow">Creator studio</p>
          <h1>ศูนย์สร้างบทเรียน</h1>
          <p>ตรวจฉบับร่าง สร้างควิซ และเตรียมสื่อให้พร้อมก่อนเปิดให้นักเรียน</p>
        </div>
        <div class="page-actions">
          <button class="primary" type="button" data-nav="/admin/quizzes/new">สร้างควิซ</button>
          <button type="button" data-nav="/admin/content/new?type=clip">สร้างคลิป</button>
          <button type="button" data-nav="/admin/content/new?type=fact">สร้างเกร็ดวิทย์</button>
        </div>
      </section>
      ${creatorOverview(quizzes, contentItems, polishItems)}
      ${renderAchievementBoard(BADGE_CATALOG.map((badge) => ({ ...badge, unlocked: true, progressText: "" })), { admin: true, compact: true })}
      ${creatorPolishQueue(polishItems)}
      <section class="section-head compact">
        <div>
          <p class="eyebrow">ควิซ</p>
          <h2>จัดการควิซ</h2>
        </div>
      </section>
      <section class="quiz-grid">
        ${quizzes.map(renderAdminQuizCard).join("")}
      </section>
      <section class="section-head compact">
        <div>
          <p class="eyebrow">สื่อเรียนรู้</p>
          <h2>จัดการคลิปและเกร็ดวิทย์</h2>
        </div>
      </section>
      <section class="quiz-grid">
        ${contentItems.map(renderAdminContentCard).join("") || `<article class="empty-mini"><p>ยังไม่มีสื่อเรียนรู้</p></article>`}
      </section>
    </main>
  `);
}

function renderAdminQuizCard(quiz) {
  const subject = getSubject(quiz.subject);
  const errors = validateQuizDraft(quiz);
  const isDraft = quiz.status !== "published";
  const needsWork = isDraft || errors.length;
  const title = displayText(quiz.title, "ฉบับร่างยังไม่ตั้งชื่อ");
  const description =
    displayText(quiz.description) ||
    (isDraft ? "ยังไม่ได้ใส่คำอธิบาย นักเรียนจะยังไม่เห็นควิซนี้จนกว่าจะเผยแพร่" : "ยังไม่มีคำอธิบาย");
  const statusText = errors.length ? `${errors.length} จุดที่ต้องแก้` : isDraft ? "ฉบับร่างพร้อมแล้ว" : "เผยแพร่แล้ว";
  return `
    <article class="quiz-card admin-quiz-card ${needsWork ? "needs-work" : ""}" style="--subject: ${subject.accent}">
      <div class="card-line">
        <span class="subject-pill">${subject.label}</span>
        <span class="status-pill">${isDraft ? "ฉบับร่าง" : "เผยแพร่แล้ว"}</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      <div class="admin-card-readiness ${errors.length ? "not-ready" : isDraft ? "draft-ready" : "ready"}">
        <strong>${statusText}</strong>
        <small>${errors.length ? "เปิดหน้าแก้ไขเพื่อตรวจฉบับร่าง" : isDraft ? "พร้อมเปิดให้นักเรียนเมื่อเปลี่ยนสถานะ" : "แสดงในคลังควิซแล้ว"}</small>
      </div>
      <div class="card-actions">
        <button type="button" data-nav="/admin/quizzes/${quiz.id}/edit">${needsWork ? "ปรับต่อ" : "แก้ไข"}</button>
        <button class="danger-button" type="button" data-action="delete-quiz" data-quiz-id="${quiz.id}" data-delete-title="${escapeHtml(title)}">ลบ</button>
      </div>
    </article>
  `;
}

function renderAdminContentCard(item) {
  const subject = getSubject(item.subject);
  const type = getContentType(item.type);
  const errors = validateContentDraft(item);
  const isDraft = item.status !== "published";
  return `
    <article class="quiz-card admin-quiz-card ${isDraft || errors.length ? "needs-work" : ""}" style="--subject: ${subject.accent}">
      <div class="card-line">
        <span class="subject-pill">${type.thai}</span>
        <span class="status-pill">${isDraft ? "ฉบับร่าง" : "เผยแพร่แล้ว"}</span>
      </div>
      <h2>${escapeHtml(displayText(item.title, "สื่อยังไม่ตั้งชื่อ"))}</h2>
      <p>${escapeHtml(displayText(item.description, "ยังไม่มีคำอธิบาย"))}</p>
      <div class="admin-card-readiness ${errors.length ? "not-ready" : isDraft ? "draft-ready" : "ready"}">
        <strong>${errors.length ? `${errors.length} จุดที่ต้องแก้` : item.type === "fact" ? "Google Drive video" : "คลิปพร้อมดู"}</strong>
        <small>${item.url ? mediaActionLabel(item) : "ยังไม่มีลิงก์สื่อ"}</small>
      </div>
      <div class="card-actions">
        <button type="button" data-nav="/admin/content/${item.id}/edit">แก้ไข</button>
        <button class="danger-button" type="button" data-action="delete-content" data-content-id="${item.id}" data-delete-title="${escapeHtml(item.title)}">ลบ</button>
      </div>
    </article>
  `;
}

function getCreatorPolishItems(quizzes, contentItems) {
  const draftQuizzes = quizzes
    .filter((quiz) => quiz.status !== "published" || validateQuizDraft(quiz).length)
    .map((quiz) => ({
      type: "quiz",
      title: displayText(quiz.title, "ฉบับร่างยังไม่ตั้งชื่อ"),
      note: validateQuizDraft(quiz).length
        ? `${validateQuizDraft(quiz).length} จุดที่ต้องแก้ก่อนเผยแพร่`
        : "ฉบับร่างพร้อมแล้ว รอเปลี่ยนสถานะเมื่อจะเปิดให้นักเรียน",
      nav: `/admin/quizzes/${quiz.id || "new"}/edit`,
    }));
  const contentNeedsCover = contentItems
    .filter((item) => isPreviewMedia(item) && !getMediaCoverUrl(item))
    .map((item) => ({
      type: item.type,
      title: item.title,
      note: item.type === "fact" ? "ยังไม่มีภาพปกสำหรับเกร็ดวิทย์" : "ยังไม่มีภาพปกหรือ YouTube preview",
      nav: `/admin/content/${item.id}/edit`,
    }));
  return [...draftQuizzes, ...contentNeedsCover].slice(0, 4);
}

function creatorOverview(quizzes, contentItems, polishItems) {
  const publishedQuizzes = quizzes.filter((quiz) => quiz.status === "published" && !validateQuizDraft(quiz).length).length;
  const draftQuizzes = quizzes.filter((quiz) => quiz.status !== "published" || validateQuizDraft(quiz).length).length;
  const publishedContent = contentItems.filter((item) => item.status === "published" && !validateContentDraft(item).length).length;
  return `
    <section class="creator-overview" aria-label="สรุปสถานะ Creator">
      <article>
        <span>${publishedQuizzes}</span>
        <p>ควิซที่เปิดอยู่</p>
      </article>
      <article>
        <span>${publishedContent}</span>
        <p>สื่อที่เปิดอยู่</p>
      </article>
      <article>
        <span>${draftQuizzes}</span>
        <p>ฉบับร่างที่ต้องดูต่อ</p>
      </article>
      <article>
        <span>${polishItems.length}</span>
        <p>งานในคิวตรวจ</p>
      </article>
    </section>
  `;
}

function creatorPolishQueue(items) {
  return `
    <section class="creator-queue">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">รายการตรวจงาน</p>
          <h2>สิ่งที่ควรตรวจต่อ</h2>
        </div>
        <span>${items.length} งาน</span>
      </div>
      ${
        items.length
          ? `<div class="queue-list">${items
              .map(
                (item) => `
                  <article>
                    <span>${item.type === "quiz" ? "ควิซ" : "สื่อ"}</span>
                    <div>
                      <strong>${escapeHtml(item.title)}</strong>
                      <p>${escapeHtml(item.note)}</p>
                    </div>
                    <button type="button" data-nav="${item.nav}">แก้ไข</button>
                  </article>
                `,
              )
              .join("")}</div>`
          : `<p class="helper">ไม่มีรายการเร่งด่วน ตอนนี้คอนเทนต์หลักพร้อมให้นักเรียนใช้งาน</p>`
      }
    </section>
  `;
}

async function quizEditorPage(quizId) {
  if (!state.user || state.user.role !== "admin") return adminPage();
  const params = new URLSearchParams(window.location.search);
  const existing = quizId === "new" ? null : await store.getQuiz(quizId);
  const attachedContentId = existing?.contentId || params.get("contentId") || "";
  const attachedContent = attachedContentId ? await store.getContent(attachedContentId) : null;
  const quiz = existing || {
    id: "",
    title: attachedContent ? `โจทย์: ${attachedContent.title}` : "",
    description: attachedContent ? `ฝึกต่อจาก${attachedContent.type === "fact" ? "เกร็ดวิทย์" : "คลิป"} ${attachedContent.title}` : "",
    subject: attachedContent?.subject || "biology",
    status: "draft",
    contentId: attachedContentId,
    questions: [createBlankQuestion(0)],
  };
  const readiness = quizReadiness(quiz);
  const isPracticeSet = Boolean(quiz.contentId);

  return pageShell(`
    <main class="builder">
      <form data-form="save-quiz" class="builder-form">
        <input type="hidden" name="id" value="${quiz.id}" />
        <input type="hidden" name="contentId" value="${escapeHtml(quiz.contentId || "")}" />
        <section class="builder-studio">
          <div class="builder-main-column">
            <section class="form-title-card quiz-builder-title">
              <div class="builder-topline"></div>
              <div class="builder-title-head">
                <div>
                  <p class="eyebrow">${isPracticeSet ? "โจทย์หลังสื่อ" : "แบบฟอร์ม Quick quiz"}</p>
                  <h1>${quiz.id ? (isPracticeSet ? "แก้ไขโจทย์" : "แก้ไข Quick quiz") : isPracticeSet ? "สร้างโจทย์" : "สร้าง Quick quiz ใหม่"}</h1>
                </div>
                <div class="publish-readiness ${readiness.errors.length ? "not-ready" : "ready"}">
              <strong>${readiness.errors.length ? "ตรวจฉบับร่าง" : quiz.status === "published" ? "พร้อมเผยแพร่" : "ฉบับร่างพร้อมแล้ว"}</strong>
              <span class="readiness-summary">${readiness.errors.length ? `${readiness.errors.length} จุดที่ต้องแก้ก่อนเผยแพร่` : quiz.status === "published" ? "นักเรียนเห็นได้" : "พร้อมเผยแพร่เมื่อเปลี่ยนสถานะ"}</span>
                </div>
              </div>
              <label>${isPracticeSet ? "ชื่อชุดโจทย์" : "ชื่อ Quick quiz"}<input name="title" value="${escapeHtml(quiz.title)}" placeholder="${isPracticeSet ? "เช่น โจทย์หลังดูคลิป Rubber Band Car" : "เช่น Osmosis Quick Check"}" /></label>
              <label>คำอธิบาย<textarea name="description" placeholder="${isPracticeSet ? "บอกนักเรียนว่าโจทย์นี้ต่อยอดจากสื่อเรื่องอะไร" : "บอกนักเรียนว่า Quick quiz นี้ฝึกเรื่องอะไร"}">${escapeHtml(quiz.description)}</textarea></label>
              <div class="form-grid">
                <label>วิชา
                  <select name="subject">
                    ${SUBJECTS.map(
                      (subject) => `<option value="${subject.id}" ${quiz.subject === subject.id ? "selected" : ""}>${subject.label}</option>`,
                    ).join("")}
                  </select>
                </label>
                <label>สถานะ
                  <select name="status">
                    <option value="draft" ${quiz.status === "draft" ? "selected" : ""}>ฉบับร่าง</option>
                    <option value="published" ${quiz.status === "published" ? "selected" : ""}>เผยแพร่</option>
                  </select>
                </label>
              </div>
              <div class="builder-metrics">
                <span><strong data-builder-metric="questions">${quiz.questions.length}</strong> คำถาม</span>
                <span><strong data-builder-metric="points">${scoreToExp(readiness.totalPoints)}</strong> EXP รวม</span>
                <span><strong data-builder-metric="status">${statusLabel(quiz.status)}</strong> สถานะ</span>
              </div>
              <div class="readiness-output">
                ${renderReadinessOutput(readiness.errors)}
              </div>
            </section>
            <section class="builder-stack" id="builder-questions">
              ${quiz.questions.map(renderBuilderQuestion).join("")}
            </section>
            <section class="builder-actions">
              <button type="button" data-action="add-question">เพิ่มคำถาม</button>
              ${
                quiz.id
                  ? `<button class="danger-button" type="button" data-action="delete-quiz" data-quiz-id="${quiz.id}" data-delete-title="${escapeHtml(displayText(quiz.title, "ควิซนี้"))}">ลบควิซ</button>`
                  : ""
              }
              <button class="primary" type="submit">${quiz.status === "published" ? "เผยแพร่ควิซ" : "บันทึกฉบับร่าง"}</button>
            </section>
          </div>
          <aside class="quiz-live-preview" aria-live="polite">
            <p class="eyebrow">ตัวอย่างฝั่งนักเรียน</p>
            <div class="preview-quiz-card">
              <span class="subject-pill">${getSubject(quiz.subject).label}</span>
              <h2>${escapeHtml(quiz.title || "ชื่อควิซจะแสดงตรงนี้")}</h2>
              <p>${escapeHtml(quiz.description || "คำอธิบายสั้น ๆ จะช่วยให้นักเรียนรู้ว่ากำลังฝึกเรื่องอะไร")}</p>
              <div class="preview-question">
                <small>คำถาม 1</small>
                <strong>${escapeHtml(quiz.questions[0]?.prompt || "คำถามแรกจะแสดงเป็นตัวอย่าง")}</strong>
                <div class="preview-question-image">${renderQuestionImage(quiz.questions[0] || {}, true)}</div>
                <span>${escapeHtml((quiz.questions[0]?.choices || []).find((choice) => choice.label)?.label || "ตัวเลือกจะแสดงตรงนี้")}</span>
              </div>
            </div>
            <div class="preview-publish-state ${readiness.errors.length ? "not-ready" : "ready"}">
              <strong>${readiness.errors.length ? "ยังไม่พร้อมเผยแพร่" : quiz.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่างพร้อมแล้ว"}</strong>
              <span>${readiness.errors.length ? "แก้รายการตรวจฉบับร่างก่อน" : quiz.status === "published" ? "นักเรียนจะเห็นควิซนี้ในคลังควิซ" : "เปลี่ยนสถานะเป็นเผยแพร่เมื่อต้องการเปิดให้นักเรียน"}</span>
            </div>
          </aside>
        </section>
      </form>
    </main>
  `);
}

function quizReadiness(quiz) {
  const errors = validateQuizDraft(quiz);
  const totalPoints = (quiz.questions || []).reduce((total, question) => total + Number(question.points || 0), 0);
  return { errors, totalPoints };
}

function renderReadinessOutput(errors) {
  return errors.length
    ? `<ul class="readiness-list">${errors.slice(0, 4).map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
    : `<p class="helper">ควิซนี้มีคำถาม คำตอบที่ถูกต้อง และ EXP พร้อมสำหรับการเผยแพร่</p>`;
}

function contentCreatorCopy(type = "clip", isEditing = false) {
  const isFact = type === "fact";
  return {
    eyebrow: isFact ? "Google Drive fact video" : "YouTube clip",
    heading: isEditing ? (isFact ? "แก้ไขเกร็ดวิทย์" : "แก้ไขคลิป") : isFact ? "สร้างเกร็ดวิทย์" : "สร้างคลิป",
    titleLabel: isFact ? "ชื่อเกร็ดวิทย์" : "ชื่อคลิป",
    titlePlaceholder: isFact ? "เช่น ทำไมวิ่งแล้วเหนื่อยช้าลง" : "เช่น วิธีคิดโจทย์แรงเสียดทาน",
    descriptionPlaceholder: isFact ? "สรุปว่าวิดีโอสั้นนี้ทำให้นักเรียนเข้าใจเรื่องอะไร" : "บอกนักเรียนว่าคลิปนี้ช่วยให้เข้าใจอะไร",
    urlLabel: isFact ? "ลิงก์วิดีโอ Google Drive" : "ลิงก์วิดีโอ",
    urlPlaceholder: isFact ? "วางลิงก์ Google Drive ที่ตั้งค่า Anyone with the link can view" : "วางลิงก์ YouTube",
    thumbnailLabel: isFact ? "ภาพปกเกร็ดวิทย์" : "ภาพปกคลิป",
    coverHelp: isFact
      ? "ไม่จำเป็นต้องอัปโหลด ถ้า Google Drive สร้าง thumbnail ได้ ใช้อัปโหลดเฉพาะตอนอยากครอบภาพเอง"
      : "อัปโหลดภาพปกถ้า preview จาก YouTube ไม่ตรง ขนาดไฟล์ไม่เกิน 2 MB",
    previewLabel: isFact ? "ตัวอย่างเกร็ดวิทย์" : "ตัวอย่างคลิป",
    previewDescription: isFact
      ? "ใส่ชื่อ คำอธิบาย และลิงก์ Google Drive ระบบจะดึง thumbnail มาเป็นภาพปกให้อัตโนมัติ"
      : "ใส่ชื่อ คำอธิบาย และลิงก์ YouTube เพื่อดู preview ก่อนบันทึก",
  };
}

async function contentEditorPage(contentId = "new") {
  if (!state.user || state.user.role !== "admin") return adminPage();
  const params = new URLSearchParams(window.location.search);
  const existing = contentId === "new" ? null : await store.getContent(contentId);
  const requestedType = ["clip", "fact"].includes(params.get("type")) ? params.get("type") : "clip";
  const content = existing || {
    id: "",
    type: requestedType,
    title: "",
    description: "",
    subject: params.get("subject") || "biology",
    url: "",
    thumbnailUrl: "",
    thumbnailPositionX: 50,
    thumbnailPositionY: 50,
    detailText: "",
    resourceFileName: "",
    resourceFileUrl: "",
    status: "draft",
  };
  const copy = contentCreatorCopy(content.type, Boolean(existing));
  return pageShell(`
    <main class="builder">
      <form data-form="save-content" class="builder-form">
        <input type="hidden" name="id" value="${escapeHtml(content.id)}" />
        <input type="hidden" name="type" value="${escapeHtml(content.type)}" />
        <section class="builder-studio content-studio">
          <div class="builder-main-column">
            <section class="form-title-card content-editor">
              <div class="builder-topline"></div>
              <p class="eyebrow">${copy.eyebrow}</p>
              <h1 data-content-heading>${copy.heading}</h1>
              <label><span data-title-label>${copy.titleLabel}</span><input name="title" required value="${escapeHtml(content.title)}" placeholder="${copy.titlePlaceholder}" /></label>
              <label>คำอธิบาย<textarea name="description" required placeholder="${copy.descriptionPlaceholder}">${escapeHtml(content.description)}</textarea></label>
              <div class="form-grid">
                <div class="fixed-type-field">
                  <span>ประเภท</span>
                  <strong>${content.type === "fact" ? "เกร็ดวิทย์" : "คลิป"}</strong>
                  <small>${content.type === "fact" ? "สร้างจากปุ่ม + เกร็ดวิทย์" : "สร้างจากปุ่ม + คลิป"}</small>
                </div>
                <label>วิชา
                  <select name="subject">
                    ${SUBJECTS.map(
                      (subject) => `<option value="${subject.id}" ${content.subject === subject.id ? "selected" : ""}>${subject.label}</option>`,
                    ).join("")}
                  </select>
                </label>
              </div>
              <label><span data-url-label>${copy.urlLabel}</span><input name="url" value="${escapeHtml(content.url)}" placeholder="${copy.urlPlaceholder}" /></label>
              ${
                content.type === "fact"
                  ? `<label>ข้อมูลเพิ่มเติม<textarea name="detailText" placeholder="เขียนย่อหน้าขยายความ เช่น หลักการ วิธียกตัวอย่าง หรือสิ่งที่นักเรียนควรรู้ต่อจากวิดีโอ">${escapeHtml(content.detailText || "")}</textarea></label>`
                  : `<input type="hidden" name="detailText" value="${escapeHtml(content.detailText || "")}" />`
              }
              <section class="cover-image-builder ${content.type === "fact" ? "fact-cover-builder" : ""}">
                <div>
                  <p class="eyebrow" data-thumbnail-label>${copy.thumbnailLabel}</p>
                  <p data-cover-help>${copy.coverHelp}</p>
                </div>
                <input type="hidden" name="thumbnailUrl" value="${escapeHtml(content.thumbnailUrl || "")}" />
                <input type="hidden" name="thumbnailPositionX" value="${clampPercent(content.thumbnailPositionX)}" />
                <input type="hidden" name="thumbnailPositionY" value="${clampPercent(content.thumbnailPositionY)}" />
                <label class="image-upload-control">
                  <span>${content.thumbnailUrl ? "เปลี่ยนภาพปก" : "อัปโหลดภาพปก"}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-action="content-cover-image" />
                </label>
                <div class="content-cover-preview ${content.type === "fact" ? "fact-cover-preview" : ""} ${content.thumbnailUrl ? "has-image" : ""}" data-content-cover-preview>
                  ${
                    content.thumbnailUrl
                      ? `<img src="${escapeHtml(content.thumbnailUrl)}" alt="" style="${coverPositionStyle(content)}" /><button type="button" data-action="remove-content-cover">ลบภาพปก</button>`
                      : `<span>${content.type === "fact" ? "ยังไม่มีภาพปกเกร็ดวิทย์" : "ยังไม่มีภาพปก"}</span>`
                  }
                </div>
                ${
                  content.type === "fact"
                    ? `<div class="cover-crop-workspace" data-cover-crop-workspace hidden>
                        <div class="cover-focus-head">
                          <strong>ครอบภาพปก</strong>
                          <span>ปรับพื้นที่ที่ต้องการ แล้วกด Use this cover</span>
                        </div>
                        <div class="cover-crop-stage">
                          <div class="cover-crop-frame">
                            <img src="" alt="" data-cover-crop-image />
                          </div>
                        </div>
                        <label>ซ้าย / ขวา
                          <input type="range" min="0" max="100" value="${clampPercent(content.thumbnailPositionX)}" data-action="cover-position-x" />
                        </label>
                        <label>บน / ล่าง
                          <input type="range" min="0" max="100" value="${clampPercent(content.thumbnailPositionY)}" data-action="cover-position-y" />
                        </label>
                        <div class="cover-focus-presets">
                          <button type="button" data-action="cover-preset" data-x="50" data-y="20">บน</button>
                          <button type="button" data-action="cover-preset" data-x="50" data-y="50">กลาง</button>
                          <button type="button" data-action="cover-preset" data-x="50" data-y="80">ล่าง</button>
                        </div>
                        <div class="cover-crop-actions">
                          <button type="button" data-action="cancel-cover-crop">Cancel</button>
                          <button class="primary" type="button" data-action="use-cover-crop">Use this cover</button>
                        </div>
                      </div>`
                    : ""
                }
                <small class="image-upload-message" data-content-cover-message>ระบบจะครอบภาพให้พอดีกรอบ preview และไม่ทำให้ layout ยืด</small>
              </section>
              <section class="resource-file-builder">
                <div>
                  <p class="eyebrow">ไฟล์ประกอบ</p>
                  <p>อัปโหลดไฟล์เล็กไม่เกิน 5 MB หรือวางลิงก์ Google Drive/ไฟล์ภายนอก เพื่อให้นักเรียนเปิดจากหน้าเรียน</p>
                </div>
                <input type="hidden" name="resourceFileName" value="${escapeHtml(content.resourceFileName || "")}" />
                <label>ลิงก์ไฟล์ Google Drive หรือไฟล์ภายนอก
                  <input name="resourceFileUrl" value="${escapeHtml(content.resourceFileUrl || "")}" placeholder="วางลิงก์ Google Drive, PDF, slide หรือ worksheet" />
                </label>
                <label class="image-upload-control">
                  <span>${content.resourceFileUrl ? "เปลี่ยนไฟล์ประกอบ" : "อัปโหลดไฟล์ประกอบ"}</span>
                  <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp" data-action="resource-file" />
                </label>
                <div class="resource-file-preview ${content.resourceFileUrl ? "has-file" : ""}" data-resource-file-preview>
                  ${
                    content.resourceFileUrl
                      ? `<span>${escapeHtml(content.resourceFileName || "ไฟล์ประกอบ")}</span><button type="button" data-action="remove-resource-file">ลบไฟล์</button>`
                      : `<span>ยังไม่มีไฟล์ประกอบ</span>`
                  }
                </div>
                <small class="image-upload-message" data-resource-file-message>แนะนำ: ใช้ Google Drive สำหรับไฟล์ใหญ่ และตั้ง permission เป็น Anyone with the link can view</small>
              </section>
              <label>สถานะ
                <select name="status">
                  <option value="published" ${content.status === "published" ? "selected" : ""}>เผยแพร่</option>
                  <option value="draft" ${content.status === "draft" ? "selected" : ""}>ฉบับร่าง</option>
                </select>
              </label>
            </section>
          </div>
          <aside class="creator-side-panel">
            <section class="creator-preview" aria-live="polite">
              <p class="eyebrow" data-preview-label>${copy.previewLabel}</p>
              <div class="creator-preview-frame">
                <span class="play-mark">▶</span>
              </div>
              <h2>ชื่อสื่อจะแสดงตรงนี้</h2>
              <p class="preview-description">${copy.previewDescription}</p>
              <small class="preview-status">รอข้อมูลสื่อ</small>
            </section>
            <section class="content-readiness ready">
              <strong>ฉบับร่างพร้อมแล้ว</strong>
              <p class="readiness-summary">เก็บเป็นฉบับร่างได้ และยังไม่แสดงให้นักเรียน</p>
              <div class="content-readiness-output"></div>
            </section>
            ${
              content.id
                ? `<button class="danger-button wide" type="button" data-action="delete-content" data-content-id="${escapeHtml(content.id)}" data-delete-title="${escapeHtml(displayText(content.title, "สื่อนี้"))}">ลบสื่อ</button>`
                : ""
            }
            <button class="primary wide" type="submit">${content.status === "published" ? "เผยแพร่สื่อ" : "บันทึกฉบับร่าง"}</button>
          </aside>
        </section>
      </form>
    </main>
  `);
}

function renderBuilderQuestion(question, index) {
  const correctChoice = (question.choices || []).find((choice) => choice.isCorrect);
  return `
    <article class="builder-card" data-question-index="${index}" data-question-id="${question.id}">
      <div class="question-head">
        <h2>คำถาม ${index + 1}</h2>
        <button type="button" data-action="remove-question" data-question-index="${index}">ลบ</button>
      </div>
      <div class="builder-question-shell">
        <section class="builder-question-main">
          <p class="eyebrow">Question</p>
          <label>คำถาม<textarea name="q-${index}-prompt">${escapeHtml(question.prompt)}</textarea></label>
          <section class="question-image-builder">
            <div>
              <p class="eyebrow">ภาพประกอบ</p>
              <p>ใช้กับกราฟ แผนภาพ ตาราง หรือภาพทดลอง ขนาดไฟล์ไม่เกิน 2 MB</p>
            </div>
            <input type="hidden" name="q-${index}-imageUrl" value="${escapeHtml(question.imageUrl || "")}" />
            <label class="image-upload-control">
              <span>${question.imageUrl ? "เปลี่ยนรูปภาพ" : "อัปโหลดรูปภาพ"}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-action="question-image" data-question-index="${index}" />
            </label>
            <label>คำอธิบายภาพ <input name="q-${index}-imageAlt" value="${escapeHtml(question.imageAlt || "")}" placeholder="เช่น กราฟความเร็วต่อเวลา" /></label>
            <div class="question-image-preview ${question.imageUrl ? "has-image" : ""}" data-image-preview="${index}">
              ${
                question.imageUrl
                  ? `${renderQuestionImage(question, true)}<button type="button" data-action="remove-question-image" data-question-index="${index}">ลบรูปภาพ</button>`
                  : `<span>ยังไม่มีภาพประกอบ</span>`
              }
            </div>
            <small class="image-upload-message" data-image-message="${index}">ระบบจะครอบภาพแบบพอดีกรอบ ไม่ทำให้คำถามยืดหรือแตก layout</small>
          </section>
          <div class="choice-editor">
            ${(question.choices || [])
              .map(
                (choice, choiceIndex) => `
                  <label class="builder-choice">
                    <input type="radio" name="q-${index}-correct" value="${choiceIndex}" ${choice.isCorrect ? "checked" : ""} aria-label="เลือกเป็นคำตอบที่ถูก" />
                    <input name="q-${index}-choice-${choiceIndex}" value="${escapeHtml(choice.label)}" placeholder="ตัวเลือก ${choiceIndex + 1}" />
                  </label>
                `,
              )
              .join("")}
          </div>
          <button type="button" data-action="add-choice" data-question-index="${index}">เพิ่มตัวเลือก</button>
        </section>
        <aside class="answer-key-panel">
          <p class="eyebrow">Answer key</p>
          <label>EXP weight<input name="q-${index}-points" type="number" min="1" value="${question.points || 1}" /></label>
          <label>คำอธิบายหลังตอบ<textarea name="q-${index}-explanation">${escapeHtml(question.explanation || "")}</textarea></label>
          <div class="answer-key-summary">
            <span>คำตอบที่ถูก</span>
            <strong>${escapeHtml(correctChoice?.label || "ยังไม่ได้ใส่ตัวเลือก")}</strong>
          </div>
        </aside>
      </div>
    </article>
  `;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function collectQuizForm(form) {
  const data = new FormData(form);
  const cards = [...form.querySelectorAll(".builder-card")];
  return {
    id: data.get("id") || undefined,
    title: data.get("title"),
    description: data.get("description"),
    subject: data.get("subject"),
    status: data.get("status"),
    contentId: data.get("contentId") || "",
    questions: cards.map((card, index) => {
      const questionId = card.dataset.questionId || crypto.randomUUID();
      const choiceInputs = [...card.querySelectorAll(`input[name^="q-${index}-choice-"]`)];
      const correctIndex = Number(data.get(`q-${index}-correct`) || 0);
      return {
        id: questionId,
        prompt: data.get(`q-${index}-prompt`),
        imageUrl: data.get(`q-${index}-imageUrl`) || "",
        imageAlt: data.get(`q-${index}-imageAlt`) || "",
        type: "multiple_choice",
        explanation: data.get(`q-${index}-explanation`),
        points: Number(data.get(`q-${index}-points`) || 1),
        order: index,
        choices: choiceInputs.map((input, choiceIndex) => ({
          id: input.dataset.choiceId || crypto.randomUUID(),
          questionId,
          label: input.value,
          isCorrect: choiceIndex === correctIndex,
          order: choiceIndex,
        })),
      };
    }),
  };
}

async function render() {
  try {
    state.user = await store.getCurrentUser();
    const route = state.route.split("?")[0];
    const onboardingAllowedRoutes = new Set(["/onboarding", "/login", "/signup", "/forgot-password", "/reset-password"]);
    if (needsOnboarding(state.user) && !onboardingAllowedRoutes.has(route) && !route.startsWith("/admin")) {
      history.replaceState({}, "", "/onboarding");
      state.route = "/onboarding";
      return render();
    }
    const routeClass = route === "/" ? "is-home" : `has-corners route-${route.split("/")[1] || "home"}`;
    app.className = routeClass;
    if (route === "/") app.innerHTML = await homePage();
    else if (route === "/signup") app.innerHTML = authPage("signup");
    else if (route === "/login") app.innerHTML = authPage("login");
    else if (route === "/forgot-password") app.innerHTML = forgotPasswordPage();
    else if (route === "/reset-password") app.innerHTML = resetPasswordPage();
    else if (route === "/onboarding") app.innerHTML = await onboardingPage();
    else if (route === "/search") app.innerHTML = await searchPage();
    else if (route === "/subjects") app.innerHTML = await subjectsPage();
    else if (route.startsWith("/subject/")) app.innerHTML = await subjectStudyPage(route.split("/")[2]);
    else if (route.startsWith("/content/")) app.innerHTML = await contentLessonPage(route.split("/")[2]);
    else if (route === "/quizzes") app.innerHTML = await quizzesPage();
    else if (route === "/profile") app.innerHTML = await profilePage();
    else if (route === "/results") app.innerHTML = await resultsPage();
    else if (route === "/admin") app.innerHTML = await adminPage();
    else if (route.startsWith("/quiz/")) app.innerHTML = await quizTakePage(route.split("/")[2]);
    else if (route === "/admin/quizzes/new") app.innerHTML = await quizEditorPage("new");
    else if (route === "/admin/content/new") app.innerHTML = await contentEditorPage("new");
    else if (route.startsWith("/admin/content/")) app.innerHTML = await contentEditorPage(route.split("/")[3]);
    else if (route.startsWith("/admin/quizzes/")) app.innerHTML = await quizEditorPage(route.split("/")[3]);
    else app.innerHTML = pageShell(`
      <main class="empty-state route-empty-state">
        <p class="eyebrow">Not found</p>
        <h1>ไม่พบหน้า</h1>
        <p>ลิงก์นี้อาจถูกย้าย หรือยังไม่มีใน KVISdom</p>
        <button class="primary" type="button" data-nav="/">กลับหน้าแรก</button>
      </main>
    `);
    bindEvents();
    initPageMotion();
    if (state.shouldScrollTop) {
      window.scrollTo({ top: 0, left: 0 });
      state.shouldScrollTop = false;
    }
    if (state.focusStudyOnRender) {
      state.focusStudyOnRender = false;
      focusStudyChooser();
    }
  } catch (error) {
    app.innerHTML = pageShell(`<main class="empty-state"><h1>เกิดข้อผิดพลาด</h1><p>${escapeHtml(error.message)}</p></main>`);
    bindEvents();
    initPageMotion();
    if (state.shouldScrollTop) {
      window.scrollTo({ top: 0, left: 0 });
      state.shouldScrollTop = false;
    }
  }
}

function handleStartStudy() {
  if (!state.user) {
    navigate("/login");
    return;
  }

  if (needsOnboarding(state.user)) {
    navigate("/onboarding");
    return;
  }

  if (state.route.split("?")[0] !== "/") {
    state.focusStudyOnRender = true;
    navigate("/");
    return;
  }

  focusStudyChooser();
}

function focusStudyChooser() {
  const panel = app.querySelector(".home-subject-panel");
  const firstSubject = panel?.querySelector(".home-subject-card");
  if (!panel || !firstSubject) return;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  panel.classList.add("is-guiding");
  firstSubject.focus({ preventScroll: true });
  window.setTimeout(() => panel.classList.remove("is-guiding"), 1100);
}

function initPageMotion() {
  const selectors = [
    ".brand-copy > *",
    ".home-subject-panel",
    ".home-subject-card",
    ".hero-search",
    ".home-dashboard > *",
    ".topic-search-panel",
    ".search-result-card",
    ".onboarding-card",
    ".onboarding-preview",
    ".achievement-badge",
    ".study-hero",
    ".subject-overview",
    ".next-action-card",
    ".study-sequence-strip",
    ".content-tab",
    ".subject-card",
    ".quiz-card",
    ".resource-card",
    ".video-card",
    ".fact-card",
    ".lesson-row",
    ".status-board article",
    ".content-lesson-hero",
    ".lesson-player-card",
    ".download-card",
    ".fact-detail-panel",
    ".profile-player-card",
    ".profile-progress-card",
    ".profile-editor-card",
    ".profile-stat-grid article",
    ".profile-history",
    ".profile-actions",
    ".creator-overview article",
    ".creator-queue",
    ".admin-tools",
    ".form-title-card",
    ".builder-card",
    ".creator-preview",
  ].join(",");
  const nodes = [...app.querySelectorAll(selectors)].filter((node) => !node.classList.contains("motion-reveal"));
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  nodes.forEach((node, index) => {
    node.classList.add("motion-reveal");
    node.style.setProperty("--motion-index", String(Math.min(index, 10)));
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  nodes.forEach((node) => observer.observe(node));
}

async function handleDeleteQuiz(button) {
  const quizId = button.dataset.quizId;
  const title = button.dataset.deleteTitle || "ควิซนี้";
  if (!quizId) return;
  const confirmed = window.confirm(`ต้องการลบควิซ "${title}" หรือไม่?\n\nการลบนี้จะเอาคำถาม ตัวเลือก และประวัติ EXP ของควิซนี้ออกจากระบบ`);
  if (!confirmed) return;

  try {
    await store.deleteQuiz(quizId);
    const nextRoute = state.route.startsWith("/subject/") || state.route === "/" ? state.route : "/admin";
    history.pushState({}, "", nextRoute);
    state.route = nextRoute;
    state.message = "ลบควิซแล้ว";
    state.lastResult = null;
    await render();
  } catch (error) {
    setMessage(error.message);
  }
}

async function handleDeleteContent(button) {
  const contentId = button.dataset.contentId;
  const title = button.dataset.deleteTitle || "สื่อนี้";
  if (!contentId) return;
  const confirmed = window.confirm(`ต้องการลบสื่อ "${title}" หรือไม่?\n\nนักเรียนจะไม่เห็นคลิปหรือเกร็ดวิทย์นี้อีก`);
  if (!confirmed) return;

  try {
    await store.deleteContent(contentId);
    const nextRoute = state.route.startsWith("/subject/") || state.route === "/" ? state.route : "/admin";
    history.pushState({}, "", nextRoute);
    state.route = nextRoute;
    state.message = "ลบสื่อแล้ว";
    state.lastResult = null;
    await render();
  } catch (error) {
    setMessage(error.message);
  }
}

function bindEvents() {
  app.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });

  app.querySelector('[data-action="sign-out"]')?.addEventListener("click", async () => {
    await store.signOut();
    navigate("/");
  });

  app.querySelectorAll('[data-action="start-study"]').forEach((button) => {
    button.addEventListener("click", handleStartStudy);
  });

  app.querySelector('[data-action="google-auth"]')?.addEventListener("click", async () => {
    try {
      await store.signInWithGoogle();
    } catch (error) {
      setMessage(error.message);
    }
  });

  app.querySelectorAll('[data-action="delete-quiz"]').forEach((button) => {
    button.addEventListener("click", () => handleDeleteQuiz(button));
  });

  app.querySelectorAll('[data-action="delete-content"]').forEach((button) => {
    button.addEventListener("click", () => handleDeleteContent(button));
  });

  app.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", handleSubmit);
  });

  app.querySelectorAll('[data-action="avatar-option"]').forEach((input) => {
    input.addEventListener("change", () => updateAvatarPreview(input.closest("form") || app));
  });
  app.querySelectorAll("form").forEach((form) => updateAvatarPreview(form));

  app.querySelector('form[data-form="submit-quiz"]')?.addEventListener("change", updateQuizProgress);
  updateQuizProgress();

  app.querySelector('form[data-form="save-quiz"]')?.addEventListener("input", updateBuilderPreview);
  app.querySelector('form[data-form="save-quiz"]')?.addEventListener("change", updateBuilderPreview);
  updateBuilderPreview();

  app.querySelector('form[data-form="save-content"]')?.addEventListener("input", updateCreatorPreview);
  app.querySelector('form[data-form="save-content"]')?.addEventListener("change", updateCreatorPreview);
  updateCreatorPreview();

  app.querySelector('form[data-form="save-quiz"]')?.addEventListener("input", updateBuilderAnswerSummaries);
  app.querySelector('form[data-form="save-quiz"]')?.addEventListener("change", updateBuilderAnswerSummaries);
  app.querySelector('form[data-form="save-quiz"]')?.addEventListener("input", updateBuilderReadiness);
  app.querySelector('form[data-form="save-quiz"]')?.addEventListener("change", updateBuilderReadiness);
  updateBuilderAnswerSummaries();
  updateBuilderReadiness();

  app.querySelector('[data-action="add-question"]')?.addEventListener("click", () => {
    const stack = app.querySelector("#builder-questions");
    stack.insertAdjacentHTML("beforeend", renderBuilderQuestion(createBlankQuestion(stack.children.length), stack.children.length));
    bindEvents();
  });

  app.querySelectorAll('[data-action="remove-question"]').forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".builder-card").remove();
    });
  });

  app.querySelectorAll('[data-action="question-image"]').forEach((input) => {
    input.addEventListener("change", handleQuestionImageUpload);
  });

  app.querySelectorAll('[data-action="resource-file"]').forEach((input) => {
    input.addEventListener("change", handleResourceFileUpload);
  });

  app.querySelectorAll('[data-action="content-cover-image"]').forEach((input) => {
    input.addEventListener("change", handleContentCoverUpload);
  });

  app.querySelectorAll('[data-action="cover-position-x"], [data-action="cover-position-y"]').forEach((input) => {
    input.addEventListener("input", () => {
      const form = input.closest("form");
      if (!form) return;
      updateCoverCropWorkspace(form);
    });
  });

  app.querySelectorAll('[data-action="cover-preset"]').forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      if (!form) return;
      const xSlider = form.querySelector('[data-action="cover-position-x"]');
      const ySlider = form.querySelector('[data-action="cover-position-y"]');
      if (xSlider) xSlider.value = button.dataset.x || "50";
      if (ySlider) ySlider.value = button.dataset.y || "50";
      updateCoverCropWorkspace(form);
    });
  });

  app.querySelectorAll('[data-action="cancel-cover-crop"]').forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      if (!form) return;
      form.dataset.pendingCoverUrl = "";
      hideCoverCropWorkspace(form);
      const fileInput = form.querySelector('[data-action="content-cover-image"]');
      if (fileInput) fileInput.value = "";
    });
  });

  app.querySelectorAll('[data-action="use-cover-crop"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const form = button.closest("form");
      if (!form || !form.dataset.pendingCoverUrl) return;
      const message = form.querySelector("[data-content-cover-message]");
      const hidden = form.querySelector('input[name="thumbnailUrl"]');
      const xHidden = form.querySelector('input[name="thumbnailPositionX"]');
      const yHidden = form.querySelector('input[name="thumbnailPositionY"]');
      const x = clampPercent(form.querySelector('[data-action="cover-position-x"]')?.value);
      const y = clampPercent(form.querySelector('[data-action="cover-position-y"]')?.value);

      button.disabled = true;
      button.textContent = "Cropping...";
      try {
        const croppedCover = await cropCoverImage(form.dataset.pendingCoverUrl, x, y);
        if (hidden) hidden.value = croppedCover;
        if (xHidden) xHidden.value = "50";
        if (yHidden) yHidden.value = "50";
        form.dataset.pendingCoverUrl = "";
        hideCoverCropWorkspace(form);
        updateContentCoverPreview(form);
        updateCreatorPreview();
        if (message) message.textContent = "ใช้ภาพปกที่ครอบแล้วเรียบร้อย";
      } catch {
        if (message) message.textContent = "ครอบภาพไม่สำเร็จ ลองอัปโหลดภาพใหม่";
      } finally {
        button.disabled = false;
        button.textContent = "Use this cover";
      }
    });
  });

  app.querySelectorAll('[data-action="remove-content-cover"]').forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      if (!form) return;
      const hidden = form.querySelector('input[name="thumbnailUrl"]');
      const fileInput = form.querySelector('[data-action="content-cover-image"]');
      if (hidden) hidden.value = "";
      if (fileInput) fileInput.value = "";
      updateContentCoverPreview(form);
      updateCreatorPreview();
    });
  });

  app.querySelectorAll('[data-action="remove-resource-file"]').forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      if (!form) return;
      const nameInput = form.querySelector('input[name="resourceFileName"]');
      const urlInput = form.querySelector('input[name="resourceFileUrl"]');
      const fileInput = form.querySelector('[data-action="resource-file"]');
      if (nameInput) nameInput.value = "";
      if (urlInput) urlInput.value = "";
      if (fileInput) fileInput.value = "";
      updateResourceFilePreview(form);
      updateCreatorPreview();
    });
  });

  app.querySelectorAll('[data-action="remove-question-image"]').forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".builder-card");
      const index = button.dataset.questionIndex;
      const hidden = card.querySelector(`input[name="q-${index}-imageUrl"]`);
      const fileInput = card.querySelector(`[data-action="question-image"]`);
      if (hidden) hidden.value = "";
      if (fileInput) fileInput.value = "";
      updateQuestionImagePreview(card, index, "", card.querySelector(`input[name="q-${index}-imageAlt"]`)?.value || "");
      updateBuilderPreview();
    });
  });

  app.querySelectorAll('[data-action="add-choice"]').forEach((button) => {
    button.addEventListener("click", () => {
      const index = button.dataset.questionIndex;
      const editor = button.closest(".builder-card").querySelector(".choice-editor");
      const choiceIndex = editor.children.length;
      editor.insertAdjacentHTML(
        "beforeend",
        `<label class="builder-choice"><input type="radio" name="q-${index}-correct" value="${choiceIndex}" /><input name="q-${index}-choice-${choiceIndex}" placeholder="ตัวเลือก ${choiceIndex + 1}" /></label>`,
      );
      updateBuilderAnswerSummaries();
      updateBuilderReadiness();
    });
  });
}

function collectAvatarFromForm(form) {
  return {
    body: form.querySelector('[name="avatarBody"]')?.value || DEFAULT_AVATAR.body,
    color: form.querySelector('[name="avatarColor"]')?.value || DEFAULT_AVATAR.color,
    face: form.querySelector('[name="avatarFace"]')?.value || DEFAULT_AVATAR.face,
    accessory: form.querySelector('[name="avatarAccessory"]')?.value || DEFAULT_AVATAR.accessory,
  };
}

function updateAvatarPreview(container) {
  const preview = container?.querySelector?.("[data-avatar-preview]");
  if (!preview) return;
  preview.innerHTML = renderAvatar({ avatar: collectAvatarFromForm(container) });
}

function handleQuestionImageUpload(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  const card = input.closest(".builder-card");
  const index = input.dataset.questionIndex;
  const message = card.querySelector(`[data-image-message="${index}"]`);
  if (!file || !card) return;

  if (!file.type.startsWith("image/")) {
    input.value = "";
    if (message) message.textContent = "อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น";
    return;
  }

  if (file.size > MAX_QUESTION_IMAGE_BYTES) {
    input.value = "";
    if (message) message.textContent = "ไฟล์ใหญ่เกิน 2 MB กรุณาย่อรูปก่อนอัปโหลด";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const imageUrl = String(reader.result || "");
    const hidden = card.querySelector(`input[name="q-${index}-imageUrl"]`);
    const alt = card.querySelector(`input[name="q-${index}-imageAlt"]`)?.value || "";
    if (hidden) hidden.value = imageUrl;
    updateQuestionImagePreview(card, index, imageUrl, alt);
    if (message) message.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB พร้อมใช้`;
    updateBuilderPreview();
    updateBuilderReadiness();
  };
  reader.readAsDataURL(file);
}

function handleContentCoverUpload(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  const form = input.closest("form");
  const message = form?.querySelector("[data-content-cover-message]");
  if (!file || !form) return;

  if (!file.type.startsWith("image/")) {
    input.value = "";
    if (message) message.textContent = "อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น";
    return;
  }

  if (file.size > MAX_COVER_IMAGE_BYTES) {
    input.value = "";
    if (message) message.textContent = "ไฟล์ใหญ่เกิน 2 MB กรุณาย่อรูปก่อนอัปโหลด";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const imageUrl = String(reader.result || "");
    const type = form.querySelector('input[name="type"]')?.value || "clip";
    if (type === "fact") {
      form.dataset.pendingCoverUrl = imageUrl;
      const xSlider = form.querySelector('[data-action="cover-position-x"]');
      const ySlider = form.querySelector('[data-action="cover-position-y"]');
      if (xSlider) xSlider.value = "50";
      if (ySlider) ySlider.value = "50";
      showCoverCropWorkspace(form);
      if (message) message.textContent = `${file.name} · เลือกพื้นที่ครอบ แล้วกด Use this cover`;
      return;
    }
    const hidden = form.querySelector('input[name="thumbnailUrl"]');
    if (hidden) hidden.value = imageUrl;
    if (message) message.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB พร้อมใช้เป็นภาพปก`;
    updateContentCoverPreview(form);
    updateCreatorPreview();
  };
  reader.readAsDataURL(file);
}

function handleResourceFileUpload(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  const form = input.closest("form");
  const message = form?.querySelector("[data-resource-file-message]");
  if (!file || !form) return;

  if (file.size > MAX_RESOURCE_FILE_BYTES) {
    input.value = "";
    if (message) message.textContent = "ไฟล์ใหญ่เกิน 5 MB กรุณาย่อหรือแยกไฟล์ก่อนอัปโหลด";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const fileUrl = String(reader.result || "");
    const nameInput = form.querySelector('input[name="resourceFileName"]');
    const urlInput = form.querySelector('input[name="resourceFileUrl"]');
    if (nameInput) nameInput.value = file.name;
    if (urlInput) urlInput.value = fileUrl;
    if (message) message.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB พร้อมดาวน์โหลดในหน้าคลิป`;
    updateResourceFilePreview(form);
    updateCreatorPreview();
  };
  reader.readAsDataURL(file);
}

function showCoverCropWorkspace(form) {
  const workspace = form.querySelector("[data-cover-crop-workspace]");
  if (!workspace) return;
  workspace.hidden = false;
  updateCoverCropWorkspace(form);
}

function hideCoverCropWorkspace(form) {
  const workspace = form.querySelector("[data-cover-crop-workspace]");
  if (!workspace) return;
  workspace.hidden = true;
}

function updateCoverCropWorkspace(form) {
  const workspace = form.querySelector("[data-cover-crop-workspace]");
  const image = form.querySelector("[data-cover-crop-image]");
  const source = form.dataset.pendingCoverUrl || "";
  if (!workspace || !image || !source) return;
  const x = clampPercent(form.querySelector('[data-action="cover-position-x"]')?.value);
  const y = clampPercent(form.querySelector('[data-action="cover-position-y"]')?.value);
  image.src = source;
  image.style.objectPosition = `${x}% ${y}%`;
}

function cropCoverImage(source, x = 50, y = 50) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const outputWidth = 1200;
      const outputHeight = 1500;
      const targetRatio = outputWidth / outputHeight;
      const imageRatio = image.naturalWidth / image.naturalHeight;
      let sx = 0;
      let sy = 0;
      let sw = image.naturalWidth;
      let sh = image.naturalHeight;

      if (imageRatio > targetRatio) {
        sw = image.naturalHeight * targetRatio;
        sx = (image.naturalWidth - sw) * (clampPercent(x) / 100);
      } else {
        sh = image.naturalWidth / targetRatio;
        sy = (image.naturalHeight - sh) * (clampPercent(y) / 100);
      }

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      context.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = reject;
    image.src = source;
  });
}

function updateContentCoverPreview(form) {
  const preview = form.querySelector("[data-content-cover-preview]");
  const imageUrl = form.querySelector('input[name="thumbnailUrl"]')?.value || "";
  const type = form.querySelector('input[name="type"]')?.value || "clip";
  const url = form.querySelector('input[name="url"]')?.value || "";
  const driveCoverUrl = type === "fact" ? getGoogleDriveThumbnailUrl(url) : "";
  const previewUrl = imageUrl || driveCoverUrl;
  const positionStyle = coverPositionStyle(
    form.querySelector('input[name="thumbnailPositionX"]')?.value || 50,
    form.querySelector('input[name="thumbnailPositionY"]')?.value || 50,
  );
  if (!preview) return;
  preview.classList.toggle("has-image", Boolean(previewUrl));
  preview.innerHTML = previewUrl
    ? `<img src="${escapeHtml(previewUrl)}" alt="" style="${imageUrl ? positionStyle : ""}" />${
        imageUrl
          ? `<button type="button" data-action="remove-content-cover">ลบภาพปก</button>`
          : `<span class="auto-cover-note">ใช้ thumbnail จาก Google Drive</span>`
      }`
    : `<span>${type === "fact" ? "ยังไม่มีภาพปกเกร็ดวิทย์" : "ยังไม่มีภาพปก"}</span>`;
  preview.querySelector('[data-action="remove-content-cover"]')?.addEventListener("click", () => {
    const hidden = form.querySelector('input[name="thumbnailUrl"]');
    const fileInput = form.querySelector('[data-action="content-cover-image"]');
    if (hidden) hidden.value = "";
    if (fileInput) fileInput.value = "";
    updateContentCoverPreview(form);
    updateCreatorPreview();
  });
}

function updateResourceFilePreview(form) {
  const preview = form.querySelector("[data-resource-file-preview]");
  const name = form.querySelector('input[name="resourceFileName"]')?.value || "";
  const fileUrl = form.querySelector('input[name="resourceFileUrl"]')?.value || "";
  if (!preview) return;
  const resourceLabel = name || (isGoogleDriveUrl(fileUrl) ? "Google Drive" : "ไฟล์ประกอบ");
  preview.classList.toggle("has-file", Boolean(fileUrl));
  preview.innerHTML = fileUrl
    ? `<span>${escapeHtml(resourceLabel)}</span><button type="button" data-action="remove-resource-file">ลบไฟล์</button>`
    : `<span>ยังไม่มีไฟล์ประกอบ</span>`;
  preview.querySelector('[data-action="remove-resource-file"]')?.addEventListener("click", () => {
    const nameInput = form.querySelector('input[name="resourceFileName"]');
    const urlInput = form.querySelector('input[name="resourceFileUrl"]');
    const fileInput = form.querySelector('[data-action="resource-file"]');
    if (nameInput) nameInput.value = "";
    if (urlInput) urlInput.value = "";
    if (fileInput) fileInput.value = "";
    updateResourceFilePreview(form);
    updateCreatorPreview();
  });
}

function updateQuestionImagePreview(card, index, imageUrl, imageAlt = "") {
  const preview = card.querySelector(`[data-image-preview="${index}"]`);
  if (!preview) return;
  preview.classList.toggle("has-image", Boolean(imageUrl));
  preview.innerHTML = imageUrl
    ? `${renderQuestionImage({ imageUrl, imageAlt }, true)}<button type="button" data-action="remove-question-image" data-question-index="${index}">ลบรูปภาพ</button>`
    : `<span>ยังไม่มีภาพประกอบ</span>`;
  preview.querySelector('[data-action="remove-question-image"]')?.addEventListener("click", () => {
    const hidden = card.querySelector(`input[name="q-${index}-imageUrl"]`);
    const fileInput = card.querySelector(`[data-action="question-image"]`);
    if (hidden) hidden.value = "";
    if (fileInput) fileInput.value = "";
    updateQuestionImagePreview(card, index, "", imageAlt);
    updateBuilderPreview();
  });
}

function updateBuilderAnswerSummaries() {
  app.querySelectorAll(".builder-card").forEach((card) => {
    const summary = card.querySelector(".answer-key-summary strong");
    if (!summary) return;
    const checked = card.querySelector('input[type="radio"]:checked');
    const selectedChoice = checked?.closest(".builder-choice")?.querySelector('input[type="text"], input:not([type])');
    summary.textContent = selectedChoice?.value?.trim() || "ยังไม่ได้ใส่ตัวเลือก";
  });
}

function updateBuilderReadiness() {
  const form = app.querySelector('form[data-form="save-quiz"]');
  if (!form) return;
  const quiz = collectQuizForm(form);
  const errors = validateQuizDraft(quiz);
  const totalPoints = (quiz.questions || []).reduce((total, question) => total + Number(question.points || 0), 0);
  const readiness = app.querySelector(".publish-readiness");
  const readinessTitle = readiness?.querySelector("strong");
  const readinessSummary = readiness?.querySelector(".readiness-summary");
  const output = app.querySelector(".readiness-output");

  readiness?.classList.toggle("not-ready", Boolean(errors.length));
  readiness?.classList.toggle("ready", !errors.length);
  if (readinessTitle) readinessTitle.textContent = errors.length ? "ตรวจฉบับร่าง" : quiz.status === "published" ? "พร้อมเผยแพร่" : "ฉบับร่างพร้อมแล้ว";
  if (readinessSummary) {
    readinessSummary.textContent = errors.length
      ? `${errors.length} จุดที่ต้องแก้ก่อนเผยแพร่`
      : quiz.status === "published"
        ? "นักเรียนเห็นได้"
        : "พร้อมเผยแพร่เมื่อเปลี่ยนสถานะ";
  }
  const questionMetric = app.querySelector('[data-builder-metric="questions"]');
  const pointMetric = app.querySelector('[data-builder-metric="points"]');
  const statusMetric = app.querySelector('[data-builder-metric="status"]');
  const submit = app.querySelector('form[data-form="save-quiz"] .builder-actions button[type="submit"]');
  if (questionMetric) questionMetric.textContent = quiz.questions.length;
  if (pointMetric) pointMetric.textContent = scoreToExp(totalPoints);
  if (statusMetric) statusMetric.textContent = quiz.status;
  if (output) output.innerHTML = renderReadinessOutput(errors);
  if (submit) {
    const wantsPublish = quiz.status === "published";
    submit.disabled = wantsPublish && Boolean(errors.length);
    submit.textContent = wantsPublish
      ? errors.length
        ? "แก้ฉบับร่างก่อนเผยแพร่"
        : "เผยแพร่ควิซ"
      : "บันทึกฉบับร่าง";
  }
  updateBuilderPreview();
}

function updateBuilderPreview() {
  const form = app.querySelector('form[data-form="save-quiz"]');
  const preview = app.querySelector(".quiz-live-preview");
  if (!form || !preview) return;
  const quiz = collectQuizForm(form);
  const errors = validateQuizDraft(quiz);
  const subject = getSubject(quiz.subject);
  const firstQuestion = quiz.questions[0];
  const firstChoice = (firstQuestion?.choices || []).find((choice) => choice.label?.trim());
  const card = preview.querySelector(".preview-quiz-card");
  const stateBox = preview.querySelector(".preview-publish-state");

  preview.style.setProperty("--subject", subject.accent);
  card.querySelector(".subject-pill").textContent = subject.label;
  card.querySelector("h2").textContent = quiz.title?.trim() || "ชื่อควิซจะแสดงตรงนี้";
  card.querySelector("p").textContent = quiz.description?.trim() || "คำอธิบายสั้น ๆ จะช่วยให้นักเรียนรู้ว่ากำลังฝึกเรื่องอะไร";
  card.querySelector(".preview-question strong").textContent = firstQuestion?.prompt?.trim() || "คำถามแรกจะแสดงเป็นตัวอย่าง";
  const previewImage = card.querySelector(".preview-question-image");
  if (previewImage) previewImage.innerHTML = renderQuestionImage(firstQuestion || {}, true);
  card.querySelector(".preview-question span").textContent = firstChoice?.label?.trim() || "ตัวเลือกจะแสดงตรงนี้";
  stateBox.classList.toggle("not-ready", Boolean(errors.length));
  stateBox.classList.toggle("ready", !errors.length);
  stateBox.querySelector("strong").textContent = errors.length ? "ยังไม่พร้อมเผยแพร่" : quiz.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่างพร้อมแล้ว";
  stateBox.querySelector("span").textContent = errors.length
    ? "แก้รายการตรวจฉบับร่างก่อน"
    : quiz.status === "published"
      ? "นักเรียนจะเห็นควิซนี้ในคลังควิซ"
      : "เปลี่ยนสถานะเป็นเผยแพร่เมื่อต้องการเปิดให้นักเรียน";
}

function updateQuizProgress() {
  const form = app.querySelector('form[data-form="submit-quiz"]');
  if (!form || state.lastResult) return;
  const total = form.querySelectorAll(".question-card").length;
  const answered = new Set([...form.querySelectorAll('input[type="radio"]:checked')].map((input) => input.name)).size;
  const percent = total ? Math.round((answered / total) * 100) : 0;
  const text = form.querySelector("[data-quiz-progress-text]");
  const fill = form.querySelector("[data-quiz-progress-fill]");
  const submit = form.querySelector(".quiz-submit");
  if (text) text.textContent = `ตอบแล้ว ${answered}/${total}`;
  if (fill) fill.style.width = `${percent}%`;
  if (submit) {
    if (!state.user) {
      submit.disabled = false;
      submit.textContent = answered < total ? "เข้าสู่ระบบเพื่อบันทึก EXP" : "เข้าสู่ระบบด้วย Google เพื่อรับ EXP";
      return;
    }
    submit.disabled = answered < total;
    submit.textContent = answered < total ? "ตอบให้ครบก่อนรับ EXP" : "ส่งคำตอบและรับ EXP";
  }
}

function updateCreatorPreview() {
  const form = app.querySelector('form[data-form="save-content"]');
  const preview = app.querySelector(".creator-preview");
  if (!form || !preview) return;
  updateContentCoverPreview(form);
  updateResourceFilePreview(form);

  const data = new FormData(form);
  const type = data.get("type")?.toString() || "clip";
  const copy = contentCreatorCopy(type, Boolean(data.get("id")));
  const title = data.get("title")?.toString().trim() || "ชื่อสื่อจะแสดงตรงนี้";
  const description = data.get("description")?.toString().trim() || copy.previewDescription;
  const url = data.get("url")?.toString().trim() || "";
  const thumbnailUrl = data.get("thumbnailUrl")?.toString().trim() || "";
  const thumbnailPositionX = clampPercent(data.get("thumbnailPositionX"));
  const thumbnailPositionY = clampPercent(data.get("thumbnailPositionY"));
  const detailText = data.get("detailText")?.toString().trim() || "";
  const youtubeId = getYouTubeId(url);
  const drivePreviewUrl = getGoogleDrivePreviewUrl(url);
  const driveCoverUrl = type === "fact" ? getGoogleDriveThumbnailUrl(url) : "";
  const coverUrl = thumbnailUrl || driveCoverUrl || getYouTubeThumbnail(youtubeId);
  const draft = {
    type,
    title: data.get("title"),
    description: data.get("description"),
    subject: data.get("subject"),
    url,
    thumbnailUrl,
    thumbnailPositionX,
    thumbnailPositionY,
    detailText,
    resourceFileName: data.get("resourceFileName"),
    resourceFileUrl: data.get("resourceFileUrl"),
    status: data.get("status"),
  };
  const errors = draft.status === "published" ? validateContentDraft(draft) : [];
  const frame = preview.querySelector(".creator-preview-frame");
  const status = preview.querySelector(".preview-status");
  const readiness = app.querySelector(".content-readiness");
  const readinessTitle = readiness?.querySelector("strong");
  const readinessSummary = readiness?.querySelector(".readiness-summary");
  const readinessOutput = app.querySelector(".content-readiness-output");
  const submit = app.querySelector('form[data-form="save-content"] button[type="submit"]');
  const heading = app.querySelector("[data-content-heading]");
  const titleLabel = app.querySelector("[data-title-label]");
  const titleInput = form.querySelector('input[name="title"]');
  const descriptionInput = form.querySelector('textarea[name="description"]');
  const urlLabel = app.querySelector("[data-url-label]");
  const urlInput = form.querySelector('input[name="url"]');
  const thumbnailLabel = app.querySelector("[data-thumbnail-label]");
  const coverHelp = app.querySelector("[data-cover-help]");
  const previewLabel = app.querySelector("[data-preview-label]");

  if (heading) heading.textContent = copy.heading;
  if (titleLabel) titleLabel.textContent = copy.titleLabel;
  if (titleInput) titleInput.placeholder = copy.titlePlaceholder;
  if (descriptionInput) descriptionInput.placeholder = copy.descriptionPlaceholder;
  if (urlLabel) urlLabel.textContent = copy.urlLabel;
  if (urlInput) urlInput.placeholder = copy.urlPlaceholder;
  if (thumbnailLabel) thumbnailLabel.textContent = copy.thumbnailLabel;
  if (coverHelp) coverHelp.textContent = copy.coverHelp;
  if (previewLabel) previewLabel.textContent = copy.previewLabel;

  preview.querySelector("h2").textContent = title;
  preview.querySelector(".preview-description").textContent = description;
  frame.innerHTML =
    youtubeId && type === "clip"
      ? renderYouTubeFrame(youtubeId, title)
      : coverUrl
        ? `<img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" style="${coverPositionStyle(thumbnailPositionX, thumbnailPositionY)}" /><span class="play-mark">▶</span>`
        : `<span class="cover-needed">${type === "fact" ? "เพิ่มภาพปกเกร็ดวิทย์" : "เพิ่มภาพปกหรือ YouTube"}</span>`;
  frame.classList.toggle("has-embed", Boolean((youtubeId && type === "clip") || coverUrl));
  if (status) {
    status.textContent = youtubeId
      ? "พร้อมเล่น YouTube ในหน้า KVISdom"
      : drivePreviewUrl && coverUrl
        ? "พร้อมเล่น Google Drive video ในหน้า KVISdom"
        : drivePreviewUrl
          ? "ลิงก์ Google Drive พร้อมแล้ว ถ้า thumbnail ไม่ขึ้นค่อยอัปโหลดภาพปกเอง"
      : thumbnailUrl
        ? "ใช้ภาพปกที่แอดมินกำหนดเอง"
        : url
          ? type === "fact"
            ? "ลิงก์นี้ไม่ใช่ Google Drive video ที่ตรวจพบ"
            : "ลิงก์นี้ยังไม่มี video preview ให้เพิ่มภาพปกเอง"
          : "รอข้อมูลสื่อ";
  }
  readiness?.classList.toggle("not-ready", Boolean(errors.length));
  readiness?.classList.toggle("ready", !errors.length);
  if (readinessTitle) readinessTitle.textContent = errors.length ? "ตรวจฉบับร่าง" : draft.status === "published" ? "พร้อมเผยแพร่" : "ฉบับร่างพร้อมแล้ว";
  if (readinessSummary) {
    readinessSummary.textContent = errors.length
      ? `${errors.length} จุดที่ต้องแก้ก่อนเผยแพร่`
      : draft.status === "draft"
        ? "เก็บเป็นฉบับร่างได้ และยังไม่แสดงให้นักเรียน"
        : "สื่อนี้พร้อมแสดงให้นักเรียน";
  }
  if (readinessOutput) {
    readinessOutput.innerHTML = errors.length
      ? `<ul class="readiness-list">${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
      : "";
  }
  if (submit) {
    const wantsPublish = draft.status === "published";
    submit.disabled = wantsPublish && Boolean(errors.length);
    submit.textContent = wantsPublish
      ? errors.length
        ? "แก้ฉบับร่างก่อนเผยแพร่"
        : "เผยแพร่สื่อ"
      : "บันทึกฉบับร่าง";
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formType = form.dataset.form;
  const data = new FormData(form);

  try {
    if (formType === "email-auth") {
      const email = data.get("email")?.toString().trim();
      const password = data.get("password");
      const user = await store.signIn({ email, password });
      navigate(user && needsOnboarding(user) ? "/onboarding" : "/");
    }

    if (formType === "signup") {
      const email = data.get("email")?.toString().trim();
      const user = await store.signUp({
        displayName: email?.split("@")[0] || "KVISdom Learner",
        school: "",
        email,
        password: data.get("password"),
      });
      if (user?.pendingEmailConfirmation) {
        navigate("/login");
        setMessage(`ส่งอีเมลยืนยันไปที่ ${user.email} แล้ว กรุณาเปิดลิงก์ในอีเมลก่อนเข้าสู่ระบบ`);
        return;
      }
      navigate(needsOnboarding(user) ? "/onboarding" : "/");
    }

    if (formType === "forgot-password") {
      const email = data.get("email")?.toString().trim();
      await store.requestPasswordReset(email);
      navigate("/login");
      setMessage(`ถ้า ${email} มีบัญชีอยู่ ระบบจะส่งอีเมลสำหรับตั้งรหัสผ่านใหม่ไปให้`);
      return;
    }

    if (formType === "reset-password") {
      const password = data.get("password")?.toString() || "";
      const confirmPassword = data.get("confirmPassword")?.toString() || "";
      if (password !== confirmPassword) throw new Error("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      const user = await store.updatePassword(password);
      navigate(user && needsOnboarding(user) ? "/onboarding" : "/");
      return;
    }

    if (formType === "login") {
      const user = await store.signIn({ email: data.get("email"), password: data.get("password") });
      navigate(needsOnboarding(user) ? "/onboarding" : "/");
    }

    if (formType === "topic-search") {
      const query = data.get("q")?.toString().trim() || "";
      const subject = data.get("subject")?.toString() || "all";
      const type = data.get("type")?.toString() || "all";
      const scope = form.dataset.scope || "global";
      const subjectId = form.dataset.subjectId || subject;
      const target = scope === "subject" ? `/subject/${subjectId}` : "/search";
      navigate(`${target}${buildQuery({ q: query, subject: scope === "subject" ? "" : subject, type })}`);
    }

    if (formType === "onboarding") {
      const favoriteSubject = data.get("favoriteSubject")?.toString() || "biology";
      const firstName = data.get("firstName")?.toString().trim() || "";
      const lastName = data.get("lastName")?.toString().trim() || "";
      await store.updateProfile({
        firstName,
        lastName,
        displayName: [firstName, lastName].filter(Boolean).join(" "),
        school: data.get("school")?.toString().trim(),
        favoriteSubject,
        learningGoal: data.get("learningGoal")?.toString().trim(),
        description: data.get("description")?.toString().trim(),
        avatar: collectAvatarFromForm(form),
        onboardedAt: new Date().toISOString(),
      });
      navigate(`/subject/${favoriteSubject}`);
    }

    if (formType === "save-profile") {
      const firstName = data.get("firstName")?.toString().trim() || "";
      const lastName = data.get("lastName")?.toString().trim() || "";
      await store.updateProfile({
        firstName,
        lastName,
        displayName: [firstName, lastName].filter(Boolean).join(" "),
        school: data.get("school")?.toString().trim(),
        favoriteSubject: data.get("favoriteSubject")?.toString(),
        learningGoal: data.get("learningGoal")?.toString(),
        description: data.get("description")?.toString().trim(),
        avatar: collectAvatarFromForm(form),
      });
      state.message = "บันทึกโปรไฟล์แล้ว";
      await render();
    }

    if (formType === "claim-admin") {
      await store.claimAdmin(data.get("code"));
      navigate("/admin");
    }

    if (formType === "submit-quiz") {
      const selected = Object.fromEntries([...data.entries()]);
      state.shouldScrollTop = false;
      state.lastResult = await store.submitAttempt(form.dataset.quizId, selected);
      await render();
      document.querySelector(".score-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (formType === "save-quiz") {
      const quiz = collectQuizForm(form);
      const errors = validateQuizDraft(quiz);
      if (quiz.status === "published" && errors.length) throw new Error(errors.join(" · "));
      const saved = await store.saveQuiz(quiz);
      history.pushState({}, "", `/admin/quizzes/${saved.id}/edit`);
      state.route = `/admin/quizzes/${saved.id}/edit`;
      state.message = "บันทึกควิซแล้ว";
      state.lastResult = null;
      await render();
    }

    if (formType === "save-content") {
      const content = {
        id: data.get("id") || undefined,
        type: data.get("type"),
        title: data.get("title"),
        description: data.get("description"),
        subject: data.get("subject"),
        url: data.get("url"),
        thumbnailUrl: data.get("thumbnailUrl"),
        thumbnailPositionX: data.get("thumbnailPositionX"),
        thumbnailPositionY: data.get("thumbnailPositionY"),
        detailText: data.get("detailText"),
        resourceFileName: data.get("resourceFileName"),
        resourceFileUrl: data.get("resourceFileUrl"),
        status: data.get("status"),
      };
      const errors = content.status === "published" ? validateContentDraft(content) : [];
      if (errors.length) throw new Error(errors.join(" · "));
      await store.saveContent(content);
      history.pushState({}, "", `/subject/${content.subject}`);
      state.route = `/subject/${content.subject}`;
      state.message = "บันทึกสื่อแล้ว";
      state.lastResult = null;
      await render();
    }
  } catch (error) {
    setMessage(error.message);
  }
}

render();

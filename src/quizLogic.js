export const SUBJECTS = [
  { id: "biology", label: "ชีววิทยา", short: "Bio", accent: "#1aa36f", description: "พันธุศาสตร์ เซลล์ และระบบสิ่งมีชีวิต" },
  { id: "physics", label: "ฟิสิกส์", short: "Phy", accent: "#2563eb", description: "กลศาสตร์ ไฟฟ้า พลังงาน และการทดลอง" },
  { id: "chemistry", label: "เคมี", short: "Chem", accent: "#d97706", description: "สมดุลเคมี สาร และการแยกสาร" },
  { id: "math", label: "คณิตศาสตร์", short: "Math", accent: "#dc2626", description: "ฟังก์ชัน ความน่าจะเป็น และการคิดเชิงตรรกะ" },
];

export function getSubject(subjectId) {
  return SUBJECTS.find((subject) => subject.id === subjectId) || SUBJECTS[0];
}

export function scoreQuiz(quiz, selectedChoices) {
  const questions = quiz.questions || [];
  let score = 0;
  let maxScore = 0;
  const answers = questions.map((question) => {
    const points = Number(question.points || 0);
    const selectedChoiceId = selectedChoices[question.id] || null;
    const correctChoice = (question.choices || []).find((choice) => choice.isCorrect);
    const isCorrect = Boolean(correctChoice && selectedChoiceId === correctChoice.id);
    const pointsEarned = isCorrect ? points : 0;

    maxScore += points;
    score += pointsEarned;

    return {
      questionId: question.id,
      selectedChoiceId,
      correctChoiceId: correctChoice?.id || null,
      isCorrect,
      pointsEarned,
      points,
    };
  });

  return { score, maxScore, answers };
}

export function validateQuizDraft(quiz) {
  const errors = [];
  const title = quiz.title?.trim();
  const questions = quiz.questions || [];

  if (!title) errors.push("ต้องใส่ชื่อควิซ");
  if (!quiz.subject) errors.push("ต้องเลือกวิชา");
  if (!questions.length) errors.push("ต้องมีอย่างน้อย 1 คำถาม");

  questions.forEach((question, index) => {
    const label = `ข้อ ${index + 1}`;
    const choices = question.choices || [];
    if (!question.prompt?.trim()) errors.push(`${label}: ต้องใส่คำถาม`);
    if (choices.length < 2) errors.push(`${label}: ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`);
    if (!choices.some((choice) => choice.label?.trim())) errors.push(`${label}: ต้องใส่ข้อความในตัวเลือก`);
    if (!choices.some((choice) => choice.isCorrect)) errors.push(`${label}: ต้องเลือกคำตอบที่ถูกต้อง`);
    if (Number(question.points) <= 0) errors.push(`${label}: EXP ต้องมากกว่า 0`);
  });

  return errors;
}

export function validateContentDraft(content) {
  const errors = [];
  const title = content.title?.trim() || "";
  const description = content.description?.trim() || "";
  const url = content.url?.trim() || "";
  const thumbnailUrl = content.thumbnailUrl?.trim() || "";

  if (!title) errors.push("ต้องใส่ชื่อสื่อ");
  if (title && title.length < 8) errors.push("ชื่อสื่อต้องชัดเจนกว่านี้");
  if (!description) errors.push("ต้องใส่คำอธิบายสื่อ");
  if (!content.subject) errors.push("ต้องเลือกวิชา");
  if (!content.type) errors.push("ต้องเลือกประเภทสื่อ");
  if (content.type && !["clip", "fact"].includes(content.type)) errors.push("ประเภทสื่อต้องเป็นคลิปหรือเกร็ดวิทย์");
  if (content.type === "clip" && !hasVideoSource(url, thumbnailUrl)) {
    errors.push("คลิปที่ publish ต้องมี YouTube video URL หรือภาพปก");
  }
  if (content.type === "fact" && !hasGoogleDriveSource(url)) {
    errors.push("เกร็ดวิทย์ที่ publish ต้องมีลิงก์วิดีโอ Google Drive");
  }
  return errors;
}

function hasGoogleDriveSource(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("drive.google.com") && (parsed.pathname.includes("/file/d/") || parsed.searchParams.has("id"));
  } catch {
    return false;
  }
}

function hasVideoSource(url = "", thumbnailUrl = "") {
  if (thumbnailUrl) return true;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return Boolean(parsed.pathname.slice(1).split("/")[0]);
    if (!parsed.hostname.includes("youtube.com")) return false;
    if (parsed.pathname.startsWith("/watch")) return Boolean(parsed.searchParams.get("v"));
    return parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/");
  } catch {
    return false;
  }
}

export function createBlankQuestion(order = 0) {
  const questionId = crypto.randomUUID();
  return {
    id: questionId,
    prompt: "",
    imageUrl: "",
    imageAlt: "",
    type: "multiple_choice",
    explanation: "",
    points: 1,
    order,
    choices: [
      { id: crypto.randomUUID(), questionId, label: "", isCorrect: true, order: 0 },
      { id: crypto.randomUUID(), questionId, label: "", isCorrect: false, order: 1 },
    ],
  };
}

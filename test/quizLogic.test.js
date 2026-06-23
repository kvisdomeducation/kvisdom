import test from "node:test";
import assert from "node:assert/strict";
import { createBlankQuestion, scoreQuiz, validateContentDraft, validateQuizDraft } from "../src/quizLogic.js";

test("scoreQuiz totals points and marks correctness", () => {
  const quiz = {
    questions: [
      {
        id: "q1",
        points: 2,
        choices: [
          { id: "a", isCorrect: false },
          { id: "b", isCorrect: true },
        ],
      },
      {
        id: "q2",
        points: 1,
        choices: [
          { id: "c", isCorrect: true },
          { id: "d", isCorrect: false },
        ],
      },
    ],
  };

  const result = scoreQuiz(quiz, { q1: "b", q2: "d" });

  assert.equal(result.score, 2);
  assert.equal(result.maxScore, 3);
  assert.equal(result.answers[0].isCorrect, true);
  assert.equal(result.answers[1].isCorrect, false);
});

test("validateQuizDraft blocks publishing structurally incomplete quizzes", () => {
  const errors = validateQuizDraft({
    title: "",
    subject: "biology",
    questions: [
      {
        prompt: "",
        points: 0,
        choices: [{ label: "", isCorrect: false }],
      },
    ],
  });

  assert.ok(errors.some((error) => error.includes("ชื่อควิซ")));
  assert.ok(errors.some((error) => error.includes("คำถาม")));
  assert.ok(errors.some((error) => error.includes("ตัวเลือก")));
  assert.ok(errors.some((error) => error.includes("คำตอบ")));
});

test("createBlankQuestion includes optional image fields without making images required", () => {
  const question = createBlankQuestion(0);
  const errors = validateQuizDraft({
    title: "Image-ready quiz",
    subject: "physics",
    questions: [
      {
        ...question,
        prompt: "จากกราฟนี้ ข้อใดถูกต้อง",
        imageUrl: "data:image/png;base64,test",
        imageAlt: "กราฟความเร็วต่อเวลา",
        choices: [
          { label: "ความเร็วเพิ่มขึ้น", isCorrect: true },
          { label: "ความเร็วคงที่", isCorrect: false },
        ],
      },
    ],
  });

  assert.equal(question.imageUrl, "");
  assert.equal(question.imageAlt, "");
  assert.deepEqual(errors, []);
});

test("validateContentDraft blocks weak published clip previews", () => {
  const errors = validateContentDraft({
    type: "clip",
    title: "clip",
    description: "too short",
    subject: "biology",
    url: "https://www.youtube.com/@kvisdom",
    thumbnailUrl: "",
    status: "published",
  });

  assert.ok(errors.some((error) => error.includes("ชื่อสื่อ")));
  assert.ok(errors.some((error) => error.includes("YouTube")));
});

test("validateContentDraft allows short useful clip descriptions", () => {
  const errors = validateContentDraft({
    type: "clip",
    title: "Toy Stories",
    description: "toy stories in 30 years",
    subject: "biology",
    url: "https://youtu.be/I92cjTGHFJg",
    thumbnailUrl: "",
    status: "published",
  });

  assert.deepEqual(errors, []);
});

test("validateContentDraft accepts a clip with a real YouTube thumbnail source", () => {
  const errors = validateContentDraft({
    type: "clip",
    title: "Osmosis in 90 Seconds",
    description: "ดูภาพรวมการเคลื่อนที่ของน้ำผ่านเยื่อเลือกผ่าน ก่อนลองควิซ",
    subject: "biology",
    url: "https://www.youtube.com/watch?v=aircAruvnKk",
    thumbnailUrl: "",
    status: "published",
  });

  assert.deepEqual(errors, []);
});

test("validateContentDraft treats science facts as Google Drive video media and removes other type", () => {
  const invalidOther = validateContentDraft({
    type: "other",
    title: "STEM Roadshow Challenge",
    description: "กิจกรรม active learning ที่ให้ทีมลองคิด ทดลอง และอธิบายผลด้วยตัวเอง",
    subject: "chemistry",
    url: "",
    thumbnailUrl: "",
    status: "published",
  });
  const invalidFact = validateContentDraft({
    type: "fact",
    title: "ทำไม exponential ถึงโตไวเกินคาด",
    description: "เมื่อจำนวนเพิ่มแบบคูณ ผลต่างช่วงหลังจะใหญ่กว่าช่วงแรกมาก",
    subject: "math",
    url: "https://example.com/not-a-drive-video",
    thumbnailUrl: "",
    status: "published",
  });
  const validFact = validateContentDraft({
    type: "fact",
    title: "ทำไม exponential ถึงโตไวเกินคาด",
    description: "เมื่อจำนวนเพิ่มแบบคูณ ผลต่างช่วงหลังจะใหญ่กว่าช่วงแรกมาก",
    subject: "math",
    url: "https://drive.google.com/file/d/1mathKvisdomDemoPreview/view?usp=sharing",
    thumbnailUrl: "",
    status: "published",
  });

  assert.ok(invalidOther.some((error) => error.includes("คลิปหรือเกร็ดวิทย์")));
  assert.ok(invalidFact.some((error) => error.includes("Google Drive")));
  assert.deepEqual(validFact, []);
});

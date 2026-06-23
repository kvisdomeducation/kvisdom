import { createClient } from "@supabase/supabase-js";
import { DEMO_CONTENT, DEMO_QUIZZES } from "./demoData.js";
import { scoreQuiz, validateContentDraft } from "./quizLogic.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const adminCode = import.meta.env.VITE_ADMIN_CODE || "KVISDOM-ADMIN";

const storageKey = "kvisdom.portal.v1";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function readLocalState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const state = JSON.parse(saved);
    const demoStudent = state.users?.find(
      (user) => user.id === "demo-student" || user.email === "student@kvisdom.local" || user.displayName === "KVISdom Learner",
    );
    const demoAdmin = state.users?.find((user) => user.id === "demo-admin" || user.email === "admin@kvisdom.local");
    let changed = false;
    if (demoStudent && demoStudent.role !== "student") {
      demoStudent.role = "student";
      changed = true;
    }
    if (demoStudent && !demoStudent.onboardedAt) {
      demoStudent.favoriteSubject = demoStudent.favoriteSubject || "biology";
      demoStudent.learningGoal = demoStudent.learningGoal || "ฝึกควิซวิทยาศาสตร์ให้ต่อเนื่อง";
      demoStudent.avatar = demoStudent.avatar || { body: "orbit", color: "green", face: "calm", accessory: "spark" };
      demoStudent.onboardedAt = "2026-06-22T00:00:00.000Z";
      changed = true;
    }
    if (demoAdmin && demoAdmin.role !== "admin") {
      demoAdmin.role = "admin";
      changed = true;
    }
    if (demoAdmin && !demoAdmin.onboardedAt) {
      demoAdmin.favoriteSubject = demoAdmin.favoriteSubject || "physics";
      demoAdmin.learningGoal = demoAdmin.learningGoal || "สร้างบทเรียนให้รุ่นน้อง";
      demoAdmin.avatar = demoAdmin.avatar || { body: "lab", color: "purple", face: "focus", accessory: "atom" };
      demoAdmin.onboardedAt = "2026-06-22T00:00:00.000Z";
      changed = true;
    }
    if (changed) writeLocalState(state);
    return state;
  }

  const initial = {
    currentUserId: null,
    users: [
      {
        id: "demo-student",
        email: "student@kvisdom.local",
        password: "kvisdom",
        displayName: "KVISdom Learner",
        school: "Demo School",
        role: "student",
        favoriteSubject: "biology",
        learningGoal: "ฝึกควิซวิทยาศาสตร์ให้ต่อเนื่อง",
        avatar: { body: "orbit", color: "green", face: "calm", accessory: "spark" },
        onboardedAt: "2026-06-22T00:00:00.000Z",
      },
      {
        id: "demo-admin",
        email: "admin@kvisdom.local",
        password: "kvisdom",
        displayName: "KVISdom Admin",
        school: "KVIS",
        role: "admin",
        favoriteSubject: "physics",
        learningGoal: "สร้างบทเรียนให้รุ่นน้อง",
        avatar: { body: "lab", color: "purple", face: "focus", accessory: "atom" },
        onboardedAt: "2026-06-22T00:00:00.000Z",
      },
    ],
    quizzes: DEMO_QUIZZES,
    content: DEMO_CONTENT,
    attempts: [],
  };
  localStorage.setItem(storageKey, JSON.stringify(initial));
  return initial;
}

function writeLocalState(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

function normalizeSupabaseQuiz(row, questions = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    subject: row.subject,
    status: row.status,
    contentId: row.content_id || "",
    createdAt: row.created_at,
    questions,
  };
}

function normalizeSupabaseContent(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description || "",
    subject: row.subject,
    url: row.url || "",
    thumbnailUrl: row.thumbnail_url || "",
    thumbnailPositionX: Number(row.thumbnail_position_x ?? 50),
    thumbnailPositionY: Number(row.thumbnail_position_y ?? 50),
    detailText: row.detail_text || "",
    resourceFileName: row.resource_file_name || "",
    resourceFileUrl: row.resource_file_url || "",
    status: row.status,
    createdAt: row.created_at,
  };
}

function isUsableUrl(value = "") {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isYouTubeUrl(value = "") {
  try {
    const parsed = new URL(value);
    return parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be");
  } catch {
    return false;
  }
}

function hasYouTubeVideoId(value = "") {
  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes("youtu.be")) return Boolean(parsed.pathname.slice(1).split("/")[0]);
    if (!parsed.hostname.includes("youtube.com")) return false;
    if (parsed.pathname.startsWith("/watch")) return Boolean(parsed.searchParams.get("v"));
    return parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/");
  } catch {
    return false;
  }
}

function isSupportedContentType(type = "") {
  return type === "clip" || type === "fact";
}

function reconcileDemoContent(contentItems = [], deletedContentIds = []) {
  const deletedIds = new Set(deletedContentIds);
  const demoById = new Map(DEMO_CONTENT.map((item) => [item.id, item]));
  const supportedItems = contentItems
    .filter((item) => isSupportedContentType(item.type))
    .filter((item) => !deletedIds.has(item.id));
  const contentById = new Map(supportedItems.map((item) => [item.id, item]));
  const reconciled = supportedItems.map((item) => {
    const updatedDemo = demoById.get(item.id);
    if (!updatedDemo) return item;
    return {
      ...item,
      url: hasYouTubeVideoId(item.url) || !updatedDemo.url ? item.url : updatedDemo.url,
      thumbnailUrl: item.thumbnailUrl || updatedDemo.thumbnailUrl || "",
      thumbnailPositionX: item.thumbnailPositionX ?? updatedDemo.thumbnailPositionX ?? 50,
      thumbnailPositionY: item.thumbnailPositionY ?? updatedDemo.thumbnailPositionY ?? 50,
      detailText: item.detailText || updatedDemo.detailText || "",
      resourceFileName: item.resourceFileName || updatedDemo.resourceFileName || "",
      resourceFileUrl: item.resourceFileUrl || updatedDemo.resourceFileUrl || "",
    };
  });
  DEMO_CONTENT.forEach((item) => {
    if (isSupportedContentType(item.type) && !deletedIds.has(item.id) && !contentById.has(item.id)) reconciled.push(item);
  });
  return reconciled;
}

async function listSupabaseQuizzes({ includeDrafts = false } = {}) {
  let query = supabase.from("quizzes").select("*").order("created_at", { ascending: false });
  if (!includeDrafts) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => normalizeSupabaseQuiz(row));
}

async function getSupabaseQuiz(quizId) {
  const [{ data: quiz, error: quizError }, { data: questions, error: questionError }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", quizId).single(),
    supabase
      .from("questions")
      .select("*, choices(*)")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true }),
  ]);
  if (quizError) throw quizError;
  if (questionError) throw questionError;

  const normalizedQuestions = questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    imageUrl: question.image_url || "",
    imageAlt: question.image_alt || "",
    type: question.type,
    explanation: question.explanation || "",
    points: question.points,
    order: question.order_index,
    choices: question.choices
      .map((choice) => ({
        id: choice.id,
        questionId: question.id,
        label: choice.label,
        isCorrect: choice.is_correct,
        order: choice.order_index,
      }))
      .sort((a, b) => a.order - b.order),
  }));

  return normalizeSupabaseQuiz(quiz, normalizedQuestions);
}

export const store = {
  mode: supabase ? "supabase" : "local",

  async getCurrentUser() {
    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData.session?.user;
      if (!authUser) return null;
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
      if (error) throw error;
      return {
        id: authUser.id,
        email: authUser.email,
        displayName: profile.display_name,
        school: profile.school,
        role: profile.role,
        favoriteSubject: profile.favorite_subject,
        learningGoal: profile.learning_goal,
        avatar: profile.avatar || {},
        onboardedAt: profile.onboarded_at,
      };
    }

    const state = readLocalState();
    return publicUser(state.users.find((user) => user.id === state.currentUserId));
  },

  async signUp({ email, password, displayName, school }) {
    const safeEmail = String(email || "").trim();
    const safeDisplayName = displayName || safeEmail.split("@")[0] || "KVISdom Learner";
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({ email: safeEmail, password });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) return null;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        display_name: safeDisplayName,
        school: school || "",
        role: "student",
        favorite_subject: null,
        learning_goal: "",
        avatar: {},
        onboarded_at: null,
      });
      if (profileError) throw profileError;
      return this.getCurrentUser();
    }

    const state = readLocalState();
    if (state.users.some((user) => user.email.toLowerCase() === safeEmail.toLowerCase())) {
      throw new Error("อีเมลนี้มีบัญชีแล้ว");
    }
    const user = {
      id: crypto.randomUUID(),
      email: safeEmail,
      password,
      displayName: safeDisplayName,
      school: school || "",
      role: "student",
      favoriteSubject: "",
      learningGoal: "",
      avatar: { body: "orbit", color: "green", face: "calm", accessory: "spark" },
      onboardedAt: "",
    };
    state.users.push(user);
    state.currentUserId = user.id;
    writeLocalState(state);
    return publicUser(user);
  },

  async updateProfile(profileDraft) {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) throw new Error("ต้องเข้าสู่ระบบก่อน");

    const avatar = profileDraft.avatar || currentUser.avatar || {};
    const onboardedAt = profileDraft.onboardedAt || currentUser.onboardedAt || new Date().toISOString();

    if (supabase) {
      const payload = {
        display_name: profileDraft.displayName || currentUser.displayName || "KVISdom Learner",
        school: profileDraft.school || "",
        favorite_subject: profileDraft.favoriteSubject || null,
        learning_goal: profileDraft.learningGoal || "",
        avatar,
        onboarded_at: onboardedAt,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", currentUser.id);
      if (error) throw error;
      return this.getCurrentUser();
    }

    const state = readLocalState();
    const user = state.users.find((candidate) => candidate.id === state.currentUserId);
    if (!user) throw new Error("ต้องเข้าสู่ระบบก่อน");
    user.displayName = profileDraft.displayName || user.displayName || "KVISdom Learner";
    user.school = profileDraft.school || "";
    user.favoriteSubject = profileDraft.favoriteSubject || user.favoriteSubject || "";
    user.learningGoal = profileDraft.learningGoal || "";
    user.avatar = avatar;
    user.onboardedAt = onboardedAt;
    writeLocalState(state);
    return publicUser(user);
  },

  async signIn({ email, password }) {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return this.getCurrentUser();
    }

    const state = readLocalState();
    const user = state.users.find(
      (candidate) => candidate.email.toLowerCase() === email.toLowerCase() && candidate.password === password,
    );
    if (!user) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    state.currentUserId = user.id;
    writeLocalState(state);
    return publicUser(user);
  },

  async signOut() {
    if (supabase) {
      await supabase.auth.signOut();
      return;
    }
    const state = readLocalState();
    state.currentUserId = null;
    writeLocalState(state);
  },

  async claimAdmin(code) {
    if (code !== adminCode) throw new Error("รหัสแอดมินไม่ถูกต้อง");

    if (supabase) {
      const user = await this.getCurrentUser();
      if (!user) throw new Error("ต้องเข้าสู่ระบบก่อน");
      const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
      if (error) throw error;
      return this.getCurrentUser();
    }

    const state = readLocalState();
    const user = state.users.find((candidate) => candidate.id === state.currentUserId);
    if (!user) throw new Error("ต้องเข้าสู่ระบบก่อน");
    if (user.id === "demo-student" || user.email === "student@kvisdom.local" || user.displayName === "KVISdom Learner") {
      throw new Error("บัญชี Learner สำหรับทดสอบถูกล็อกให้เป็นนักเรียน ใช้บัญชี admin@kvisdom.local สำหรับ Creator");
    }
    user.role = "admin";
    writeLocalState(state);
    return publicUser(user);
  },

  async listQuizzes({ includeDrafts = false } = {}) {
    if (supabase) return listSupabaseQuizzes({ includeDrafts });
    const state = readLocalState();
    return state.quizzes
      .filter((quiz) => includeDrafts || quiz.status === "published")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async listContent({ includeDrafts = false } = {}) {
    if (supabase) {
      let query = supabase.from("content_items").select("*").order("created_at", { ascending: false });
      if (!includeDrafts) query = query.eq("status", "published");
      const { data, error } = await query;
      if (error) throw error;
      return data
        .map(normalizeSupabaseContent)
        .filter((item) => isSupportedContentType(item.type))
        .filter((item) => includeDrafts || !validateContentDraft(item).length);
    }

    const state = readLocalState();
    if (!state.content) {
      state.content = DEMO_CONTENT;
      writeLocalState(state);
    }
    state.content = reconcileDemoContent(state.content, state.deletedContentIds || []);
    writeLocalState(state);
    return state.content
      .filter((item) => isSupportedContentType(item.type))
      .filter((item) => includeDrafts || (item.status === "published" && !validateContentDraft(item).length))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getContent(contentId) {
    if (supabase) {
      const { data, error } = await supabase.from("content_items").select("*").eq("id", contentId).maybeSingle();
      if (error) throw error;
      const content = data ? normalizeSupabaseContent(data) : null;
      return content && isSupportedContentType(content.type) ? content : null;
    }

    const state = readLocalState();
    if (!state.content) state.content = DEMO_CONTENT;
    state.content = reconcileDemoContent(state.content, state.deletedContentIds || []);
    writeLocalState(state);
    const content = state.content.find((item) => item.id === contentId) || null;
    return content && isSupportedContentType(content.type) ? content : null;
  },

  async saveContent(contentDraft) {
    if (!isSupportedContentType(contentDraft.type)) throw new Error("ประเภทสื่อต้องเป็นคลิปหรือเกร็ดวิทย์");
    if (supabase) {
      const user = await this.getCurrentUser();
      if (!user || user.role !== "admin") throw new Error("ต้องเป็นแอดมินก่อน");
      const payload = {
        id: contentDraft.id || crypto.randomUUID(),
        type: contentDraft.type,
        title: contentDraft.title,
        description: contentDraft.description,
        subject: contentDraft.subject,
        url: contentDraft.url,
        thumbnail_url: contentDraft.thumbnailUrl || "",
        thumbnail_position_x: Number(contentDraft.thumbnailPositionX || 50),
        thumbnail_position_y: Number(contentDraft.thumbnailPositionY || 50),
        detail_text: contentDraft.detailText || "",
        resource_file_name: contentDraft.resourceFileName || "",
        resource_file_url: contentDraft.resourceFileUrl || "",
        status: contentDraft.status,
        created_by: user.id,
      };
      if (payload.status === "published") {
        const errors = validateContentDraft(contentDraft);
        if (errors.length) throw new Error(errors.join(" · "));
      }
      const { error } = await supabase.from("content_items").upsert(payload);
      if (error) throw error;
      return normalizeSupabaseContent(payload);
    }

    const state = readLocalState();
    if (!state.content) state.content = DEMO_CONTENT;
    const existing = state.content.find((item) => item.id === contentDraft.id);
    const saved = {
      ...contentDraft,
      id: contentDraft.id || crypto.randomUUID(),
      createdAt: existing?.createdAt || contentDraft.createdAt || new Date().toISOString(),
    };
    if (saved.status === "published") {
      const errors = validateContentDraft(saved);
      if (errors.length) throw new Error(errors.join(" · "));
    }
    const existingIndex = state.content.findIndex((item) => item.id === saved.id);
    if (existingIndex >= 0) state.content[existingIndex] = saved;
    else state.content.unshift(saved);
    state.deletedContentIds = (state.deletedContentIds || []).filter((id) => id !== saved.id);
    writeLocalState(state);
    return saved;
  },

  async deleteContent(contentId) {
    const user = await this.getCurrentUser();
    if (!user || user.role !== "admin") throw new Error("ต้องเป็นแอดมินก่อน");

    if (supabase) {
      const { error } = await supabase.from("content_items").delete().eq("id", contentId);
      if (error) throw error;
      return;
    }

    const state = readLocalState();
    state.content = (state.content || []).filter((item) => item.id !== contentId);
    state.deletedContentIds = Array.from(new Set([...(state.deletedContentIds || []), contentId]));
    writeLocalState(state);
  },

  async getQuiz(quizId) {
    if (supabase) return getSupabaseQuiz(quizId);
    const state = readLocalState();
    return state.quizzes.find((quiz) => quiz.id === quizId) || null;
  },

  async saveQuiz(quizDraft) {
    if (supabase) {
      const user = await this.getCurrentUser();
      if (!user || user.role !== "admin") throw new Error("ต้องเป็นแอดมินก่อน");

      const quizPayload = {
        id: quizDraft.id || crypto.randomUUID(),
        title: quizDraft.title,
        description: quizDraft.description,
        subject: quizDraft.subject,
        status: quizDraft.status,
        content_id: quizDraft.contentId || null,
        created_by: user.id,
      };

      const { error: quizError } = await supabase.from("quizzes").upsert(quizPayload);
      if (quizError) throw quizError;
      await supabase.from("questions").delete().eq("quiz_id", quizPayload.id);

      for (const [questionIndex, question] of quizDraft.questions.entries()) {
        const questionId = question.id || crypto.randomUUID();
        const { error: questionError } = await supabase.from("questions").insert({
          id: questionId,
          quiz_id: quizPayload.id,
          prompt: question.prompt,
          image_url: question.imageUrl || "",
          image_alt: question.imageAlt || "",
          type: "multiple_choice",
          explanation: question.explanation || "",
          points: Number(question.points || 1),
          order_index: questionIndex,
        });
        if (questionError) throw questionError;

        const choiceRows = question.choices.map((choice, choiceIndex) => ({
          id: choice.id || crypto.randomUUID(),
          question_id: questionId,
          label: choice.label,
          is_correct: choice.isCorrect,
          order_index: choiceIndex,
        }));
        const { error: choiceError } = await supabase.from("choices").insert(choiceRows);
        if (choiceError) throw choiceError;
      }

      return getSupabaseQuiz(quizPayload.id);
    }

    const state = readLocalState();
    const savedQuiz = {
      ...quizDraft,
      id: quizDraft.id || crypto.randomUUID(),
      createdAt: quizDraft.createdAt || new Date().toISOString(),
    };
    const existingIndex = state.quizzes.findIndex((quiz) => quiz.id === savedQuiz.id);
    if (existingIndex >= 0) state.quizzes[existingIndex] = savedQuiz;
    else state.quizzes.unshift(savedQuiz);
    writeLocalState(state);
    return savedQuiz;
  },

  async deleteQuiz(quizId) {
    const user = await this.getCurrentUser();
    if (!user || user.role !== "admin") throw new Error("ต้องเป็นแอดมินก่อน");

    if (supabase) {
      const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
      if (error) throw error;
      return;
    }

    const state = readLocalState();
    state.quizzes = state.quizzes.filter((quiz) => quiz.id !== quizId);
    state.attempts = (state.attempts || []).filter((attempt) => attempt.quizId !== quizId);
    writeLocalState(state);
  },

  async submitAttempt(quizId, selectedChoices) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("ต้องเข้าสู่ระบบก่อนทำควิซ");
    const quiz = await this.getQuiz(quizId);
    if (!quiz) throw new Error("ไม่พบควิซ");
    const result = scoreQuiz(quiz, selectedChoices);

    if (supabase) {
      const { data: attempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({
          quiz_id: quizId,
          student_id: user.id,
          score: result.score,
          max_score: result.maxScore,
        })
        .select()
        .single();
      if (attemptError) throw attemptError;

      const answerRows = result.answers.map((answer) => ({
        attempt_id: attempt.id,
        question_id: answer.questionId,
        selected_choice_id: answer.selectedChoiceId,
        is_correct: answer.isCorrect,
        points_earned: answer.pointsEarned,
      }));
      const { error: answerError } = await supabase.from("answers").insert(answerRows);
      if (answerError) throw answerError;
      return { ...result, attemptId: attempt.id };
    }

    const state = readLocalState();
    const attempt = {
      id: crypto.randomUUID(),
      quizId,
      studentId: user.id,
      score: result.score,
      maxScore: result.maxScore,
      submittedAt: new Date().toISOString(),
      answers: result.answers,
    };
    state.attempts.unshift(attempt);
    writeLocalState(state);
    return { ...result, attemptId: attempt.id };
  },

  async listAttempts() {
    const user = await this.getCurrentUser();
    if (!user) return [];

    if (supabase) {
      const { data, error } = await supabase
        .from("attempts")
        .select("*, quizzes(title, subject)")
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: attempt.quizzes?.title || "Untitled quiz",
        subject: attempt.quizzes?.subject || "biology",
        score: attempt.score,
        maxScore: attempt.max_score,
        submittedAt: attempt.submitted_at,
      }));
    }

    const state = readLocalState();
    return state.attempts
      .filter((attempt) => attempt.studentId === user.id)
      .map((attempt) => {
        const quiz = state.quizzes.find((candidate) => candidate.id === attempt.quizId);
        return {
          ...attempt,
          quizTitle: quiz?.title || "Untitled quiz",
          subject: quiz?.subject || "biology",
        };
      });
  },
};

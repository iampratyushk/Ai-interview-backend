import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// ✅ Initialize OpenRouter (OpenAI compatible)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5000", // Optional, for OpenRouter rankings
    "X-Title": "AI Interview Platform", // Optional, for OpenRouter rankings
  }
});

// ✅ Model Selection
const MODEL_NAME = "google/gemini-2.0-flash-001";

// -------------------------------
// 💡 Helper: Role-Specific System Prompt
// -------------------------------
const getSystemPrompt = (role: string, resumeText: string, history: { question: string, answer: string }[], level: string = "Medium") => {
  const hasHistory = history.length > 0;
  const levelInstructions: Record<string, string> = {
    "Easy": "Target: Junior level. Focus on core basics, fundamental syntax, and simple problem-solving. Maintain a helpful and encouraging tone.",
    "Medium": "Target: Mid-level. Focus on standard professional depth, real-world application, and common best practices.",
    "Hard": "Target: Senior/Staff level. Focus on complex architecture, deep technical tradeoffs, performance at scale, and edge cases.",
    "Cracked": "Target: Elite/Top 0.1% caliber. Ask extremely challenging, high-pressure questions. Focus on obscure language internals, advanced concurrency, deep memory management, and high-complexity logical puzzles. No mercy."
  };

  const levelFocus = levelInstructions[level] || levelInstructions["Medium"];

  if (role === "Laravel Developer") {
    return `
You are an experienced and professional Laravel (PHP) interviewer conducting a real technical interview at a ${level} difficulty level.

OBJECTIVE:
Evaluate the candidate’s Laravel and PHP knowledge across fundamentals, framework expertise, architecture, and real-world problem solving.

LEVEL FOCUS:
${levelFocus}

CONTEXT:
- Candidate Resume/Background: ${resumeText || "No resume provided."}
- Interview History (Previous Questions & Answers): ${JSON.stringify(history)}

INTERVIEW FLOW RULES:
1. INTRODUCTION PHASE (MANDATORY):
   - If history is COMPLETELY EMPTY, ask for a brief introduction (background, Laravel experience, projects).
   - If there is ANY history, assume the introduction is ALREADY DONE. DO NOT ask for an introduction again.
2. TECHNICAL DEEP-DIVE (After introduction):
   - Progress from advanced → intermediate → basic (reverse pyramid to test depth early).
   - Mix Laravel-specific, PHP fundamentals, and system design questions.
   - Ask follow-up questions based on the candidate’s previous answers to go deeper.
3. Keep each question concise (max 2–3 sentences).
4. Ask only ONE question at a time.
5. Do NOT provide answers, hints, or explanations.
6. If the candidate struggles, slightly simplify the next question.

TOPICS TO COVER:
- Core PHP fundamentals (OOP, traits, namespaces, memory, execution lifecycle)
- Laravel architecture (MVC, service container, service providers)
- Routing, middleware, and request lifecycle
- Eloquent ORM (relationships, eager vs lazy loading, N+1 problem)
- Authentication & authorization (guards, policies)
- Queues, jobs, events, and scheduling
- API development (REST, validation, resources)
- Caching, performance optimization
- Database design and migrations
- Testing (unit/feature tests)
- Security (CSRF, XSS, SQL injection)

QUESTION STRATEGY:
- Start with a deep Laravel concept (e.g., service container or request lifecycle).
- Then move into:
  - Code-based questions (debugging, output prediction)
  - Real-world scenarios (scaling APIs, optimizing queries)
  - Small tasks (design an API endpoint, fix N+1 issue)
- Occasionally ask: "Why would you choose this approach?" or "What are the trade-offs?"

EVALUATION GUIDELINES:
- Assess clarity, correctness, and depth of explanation.
- Focus on real-world experience, not just theory.
- Evaluate understanding of Laravel internals and best practices.

OUTPUT FORMAT:
- Return ONLY the next interview question as plain text.
- Do NOT include explanations, labels, or extra text.
`;
  }

  if (role === "Javascript Developer") {
    return `
You are an experienced and professional JavaScript interviewer conducting a real technical interview at a ${level} difficulty level.

OBJECTIVE:
Evaluate the candidate’s JavaScript knowledge across fundamentals, advanced concepts, problem-solving, and real-world application.

LEVEL FOCUS:
${levelFocus}

CONTEXT:
- Candidate Resume/Background: ${resumeText || "No resume provided."}
- Interview History (Previous Questions & Answers): ${JSON.stringify(history)}

INTERVIEW FLOW RULES:
1. INTRODUCTION PHASE (MANDATORY):
   - If history is COMPLETELY EMPTY, ask for a brief introduction (background, experience, projects).
   - If there is ANY history, assume the introduction is ALREADY DONE. DO NOT ask for an introduction again.
2. TECHNICAL DEEP-DIVE (After introduction):
   - Progress from advanced → intermediate → basic (reverse pyramid to test depth early).
   - Mix conceptual, coding, and real-world scenario questions.
   - Occasionally ask follow-up questions based on the candidate’s previous answer to go deeper.
3. Keep each question concise (max 2–3 sentences).
4. Ask only ONE question at a time.
5. Do NOT provide answers, hints, or explanations.
6. If the candidate struggles, slightly simplify the next question.

TOPICS TO COVER:
- Core JavaScript fundamentals (closures, scope, hoisting, prototypes)
- Asynchronous JavaScript (event loop, promises, async/await, callbacks)
- ES6+ features (arrow functions, destructuring, modules)
- Browser concepts (DOM, event delegation)
- Performance & optimization
- Real-world coding problems
- Debugging and edge cases

QUESTION STRATEGY:
- Start with a strong conceptual or tricky question (e.g., closures or event loop).
- Then move into:
  - Code-based questions (predict output, fix bugs)
  - Small coding tasks (write a function)
  - Scenario-based questions (optimize, design, debug)
- Occasionally ask: "Can you explain your reasoning?" or "What are the trade-offs?"

EVALUATION GUIDELINES:
- Assess clarity, correctness, and depth of explanation.
- Prefer candidates who explain "why", not just "what".
- Identify gaps and probe them with follow-ups.

OUTPUT FORMAT:
- Return ONLY the next interview question as plain text.
- Do NOT include explanations, labels, or extra text.
`;
  }

  const roleSpecificFocus: Record<string, string> = {
    "Senior Frontend Engineer": "Deep focus on React, performance (Lighthouse/Web Vitals), state management, CSS architectures, and frontend testing.",
    "Backend Developer (Node.js)": "Emphasis on API design (REST/GraphQL), database optimization, security (OWASP), scalability, and microservices.",
    "Fullstack Product Engineer": "Holistic view from database to UI. Focus on product thinking, user value, and cross-stack integration.",
    "UI/UX Designer": "Focus on interaction design, accessibility (WCAG), design systems, user empathy, and visual hierarchy.",
    "Laravel Developer": "Laravel specific idioms: Eloquent, Blade, Middleware, Laravel ecosystem, and PHP best practices."
  };

  const roleFocus = roleSpecificFocus[role] || "General software development, problem solving, and professional industry standards.";

  return `
You are an experienced and professional ${role} interviewer conducting a real interview at a ${level} difficulty level.

INTERVIEW LEVEL SPECIFICS:
${levelFocus}

ROLE-SPECIFIC FOCUS:
${roleFocus}

CONTEXT:
${resumeText ? `- Candidate Resume: ${resumeText}` : "- No resume provided. Focus on the job role description."}
- Interview History (Previous Questions & Answers): ${JSON.stringify(history)}

INTERVIEW FLOW RULES:
1. FIRST QUESTION / INTRODUCTION:
   - If history is EMPTY: Start with a warm greeting and ask for a self-introduction OR dive into a resume project.
   - If history is NOT EMPTY: DO NOT ask for an introduction. Move directly to technical or behavioral follow-ups.
2. Follow-up Logic:
   - Progress from advanced → basic complexity.
   - Mix technical (implementation details) and behavioral (soft skills, collaboration) naturally.
   - Drill into their specific experiences mentioned in the resume.
3. Keep it human-like, encouraging, but professional.
4. Topics to cover: System Design (HLD/LLD), Coding scenarios (DSA in logic), Design Patterns, and Real-world tradeoffs.
5. Avoid repeating questions.

QUESTION RULES:
- Ask ONLY one question at a time.
- Max 2 sentences per turn.
- Be concise.

OUTPUT FORMAT:
- Return ONLY the question text.
`;
};

// -------------------------------
// 🎯 Generate Interview Question
// -------------------------------
export const generateQuestion = async (
  jobRole: string,
  history: { question: string, answer: string }[],
  resumeText: string = "",
  level: string = "Medium"
) => {

  try {
    const prompt = getSystemPrompt(jobRole, resumeText, history, level);

    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "system", content: prompt }], // Now using "system" for the core instructions
    });

    const text = response.choices[0]?.message?.content || "";
    return text.trim();
  } catch (error) {
    console.error("❌ Error generating question:", error);
    return "Tell me about a challenging project you worked on and how you handled it.";
  }
};

// -------------------------------
// 🧠 Evaluate Candidate Answer
// -------------------------------
export const evaluateResponse = async (
  question: string,
  transcript: string,
  level: string = "Medium"
) => {
  try {
    const prompt = `
      You are a senior interviewer evaluating a candidate for a professional role at a ${level} difficulty level.

      Question: "${question}"
      Answer: "${transcript}"

      Evaluation Criteria for ${level} level:
      - Technical Accuracy (Strictness based on ${level} expectations)
      - Communication Clarity
      - Depth of Explanation

      Return ONLY a valid JSON object:
      {
        "feedback": "short analysis of their performance",
        "score": number (0-10),
        "technicalDetails": "specific strengths or critical gaps identified",
        "idealAnswer": "A concise, high-quality sample answer that perfectly addresses the question at a ${level} level."
      }
    `;

    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const text = response.choices[0]?.message?.content || "{}";

    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError);
      return {
        feedback: "Could not parse evaluation results.",
        score: 5,
        technicalDetails: text
      };
    }
  } catch (error) {
    console.error("❌ Evaluation error:", error);
    return {
      feedback: "Evaluation failed due to a system error.",
      score: 0,
      technicalDetails: "System error"
    };
  }
};

// -------------------------------
// 📋 List Available OpenRouter Models
// -------------------------------
export async function listModels() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
      }
    });
    const data = await response.json() as any;

    console.log("--- AVAILABLE OPENROUTER MODELS ---");
    data.data.slice(0, 10).forEach((m: any) => {
      console.log(`> ID: ${m.id}`);
      console.log(`  Name: ${m.name}`);
      console.log("-----------------------");
    });
    console.log("... and more.");
  } catch (error) {
    console.error("Failed to fetch models:", error);
  }
}

// listModels();
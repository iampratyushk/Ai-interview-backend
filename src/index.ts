import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import pdf from "pdf-parse";
import { setupDeepgram, generateTTS } from "./utils/deepgram";
import { generateQuestion, evaluateResponse } from "./utils/ai";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ai-interview")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Interview Schema
const InterviewSchema = new mongoose.Schema({
  candidateName: String,
  jobRole: String,
  level: { type: String, default: "Medium" },
  resumeText: String,
  history: [{ question: String, transcript: String, feedback: String, score: Number, technicalDetails: String, idealAnswer: String }],
  status: { type: String, default: "ongoing" },
});

const Interview = mongoose.model("Interview", InterviewSchema);

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  let deepgramStream: any = null;
  let currentInterview: any = null;

  socket.on("start-interview", async (data: { name: string, role: string, level?: string, resume?: Buffer }) => {
    console.log('User joined interview:', data.name, 'at level:', data.level);

    // ✅ Setup Deepgram immediately to catch the WebM header
    deepgramStream = await setupDeepgram(socket);

    let resumeText = "";
    console.log("📄 Extracting text from resume...", data.resume);
    if (data.resume) {
      try {
        console.log("📄 Extracting text from resume...");
        // Handle specific pdf-parse versions/structures
        const pdfData = await pdf(data.resume); // ✅ direct call
        console.log("✅ Resume text extracted (Length:", pdfData.text.length, ")");
        resumeText = pdfData.text;
        console.log("✅ Resume text extracted (Length:", resumeText.length, ")");
      } catch (err) {
        console.error("❌ Failed to parse resume:", err);
      }
    }

    currentInterview = new Interview({
      candidateName: data.name,
      jobRole: data.role,
      level: data.level || "Medium",
      resumeText: resumeText,
      history: [],
    });
    await currentInterview.save();

    // ✅ NEW: Vocal Greeting
    const greeting = `Hey ${data.name}, great to meet you! I'm preparing your interview session for the ${data.role} role now.`;
    console.log("🔊 Generating greeting audio...");
    const greetingBuffer = await generateTTS(greeting);
    if (greetingBuffer) {
      socket.emit("ai-speak", { audio: greetingBuffer, text: greeting, isQuestion: false });
    }

    console.log("🤖 Generating first question...");
    const firstQuestion = await generateQuestion(data.role, [], resumeText, data.level || "Medium");
    console.log("📝 Question built:", firstQuestion);
    // 🗑️ REMOVED: Separate text emit. Now bundled with audio.

    // Generate and send AI Audio
    console.log("🔊 Generating TTS for first question...");
    const audioBuffer = await generateTTS(firstQuestion);
    if (audioBuffer) {
      console.log(`📤 Sending AI audio + text to frontend`);
      socket.emit("ai-speak", { audio: audioBuffer, text: firstQuestion, isQuestion: true });
    } else {
      console.error("❌ Failed to generate TTS for first question");
    }
  });

  socket.on("audio-chunk", (chunk: Buffer) => {
    // ✅ Use connection.socket.send as per user's working code
    // @ts-ignore
    // console.log('chunk ::', chunk);
    if (deepgramStream && deepgramStream.socket?.readyState === 1) {
      // @ts-ignore
      deepgramStream.socket.send(chunk);
    }
  });

  socket.on("submit-answer", async (data: { question: string, transcript: string }) => {
    console.log(`📩 Received answer for: "${data.question.substring(0, 30)}..."`);
    console.log(`📝 Transcript: "${data.transcript}"`);

    // ✅ STEP 1: Evaluate the response
    const evaluation = await evaluateResponse(data.question, data.transcript, currentInterview.level);
    console.log(`✅ Evaluation complete: Score ${evaluation.score}/10`);

    currentInterview.history.push({
      question: data.question,
      transcript: data.transcript,
      feedback: evaluation.feedback,
      score: evaluation.score,
      technicalDetails: evaluation.technicalDetails,
      idealAnswer: evaluation.idealAnswer,
    });
    await currentInterview.save();

    // ✅ STEP 2: Generate next question
    console.log("🤖 Generating next question...");
    const nextQuestion = await generateQuestion(
      currentInterview.jobRole,
      currentInterview.history.map((h: any) => ({ question: h.question, answer: h.transcript })),
      currentInterview.resumeText,
      currentInterview.level
    );
    console.log('Next question ::', nextQuestion);
    socket.emit("evaluation", {
      ...evaluation,
      question: data.question,
      answer: data.transcript
    });
    // 🗑️ REMOVED: Separate text emit. Now bundled with audio.

    // ✅ STEP 3: Generate and send AI Audio
    console.log("🔊 Generating TTS for next question...");
    const audioBuffer = await generateTTS(nextQuestion);
    if (audioBuffer) {
      console.log("📤 Sending AI audio + text to frontend");
      socket.emit("ai-speak", { audio: audioBuffer, text: nextQuestion, isQuestion: true });
    } else {
      console.error("❌ Failed to generate AI audio");
    }
  });

  socket.on("end-interview", async () => {
    if (currentInterview) {
      currentInterview.status = "completed";
      await currentInterview.save();
    }
    // @ts-ignore
    if (deepgramStream && deepgramStream.socket?.readyState === 1) {
      // Send CloseStream for clean shutdown
      // @ts-ignore
      deepgramStream.socket.send(JSON.stringify({ type: 'CloseStream' }));
      deepgramStream.close();
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    // @ts-ignore
    if (deepgramStream && deepgramStream.socket?.readyState === 1) {
      // @ts-ignore
      deepgramStream.socket.send(JSON.stringify({ type: 'CloseStream' }));
      deepgramStream.close();
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

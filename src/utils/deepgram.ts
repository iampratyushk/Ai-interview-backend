import { DeepgramClient } from "@deepgram/sdk";
import dotenv from "dotenv";

dotenv.config();

// ✅ Initialize with API Key object
const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY as string });

export const setupDeepgram = async (socket: any) => {
  try {
    console.log("🚀 Initializing Deepgram v5 (Socket-level)...");

    // ✅ Use client.listen.v1.connect(...) as requested
    // @ts-ignore
    const connection = await deepgram.listen.v1.connect({
      model: "nova-3",
      encoding: "opus",
      interim_results: "true",
      language: "en-US",
      smart_format: "true",
      endpointing: 2000,
    });

    const keepAlive = setInterval(() => {
      // @ts-ignore - access underlying websocket
      if (connection && connection.socket?.readyState === 1) {
        // Send JSON KeepAlive (for WebSocket layer)
        const keepAliveMsg = JSON.stringify({ type: "KeepAlive" });
        // @ts-ignore
        connection.socket.send(keepAliveMsg);
      }
    }, 10000);

    // ✅ STEP 3: Event Listeners
    connection.on("open", () => {
      console.log("✅ [Deepgram] Connection strictly OPENED");
    });

    // Note: The message event might be called "message" or "Results" depending on emitter usage
    connection.on("message", (data: any) => {
      if (data.type === "Results" && data.channel?.alternatives?.[0]) {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript) {
          // Send all results (final and interim) for real-time feel
          socket.emit("transcript", {
            text: transcript,
            isFinal: data.is_final
          });
        }
      }
    });

    // @ts-ignore
    connection.on("metadata", (data: any) => {
      console.log("ℹ️ [Deepgram] Metadata received:", data);
    });

    // @ts-ignore
    connection.on("error", (err: any) => {
      console.error("☠️ [Deepgram] Socket Error:", err);
    });

    connection.on("close", (data: any) => {
      console.log("❌ [Deepgram] Connection strictly CLOSED (1000)", data);
      if (keepAlive) clearInterval(keepAlive);
    });

    connection.connect();
    await connection.waitForOpen();

    console.log("🎯 Deepgram is fully ready to receive audio!");
    return connection;

  } catch (error: any) {
    console.error("❌ Deepgram Setup Failure:", error);
    return null;
  }
};

/**
 * Generates an audio buffer from text using Deepgram TTS (Aura)
 */
export const generateTTS = async (text: string): Promise<Buffer | null> => {
  try {

    const response = await deepgram.speak.v1.audio.generate(
      {
        text, // ✅ body
      },

      {
        //@ts-ignore
        model: "aura-2-thalia-en", // ✅ Upgraded to Aura-2 for more natural prosody
        encoding: "mp3",
      }
    );

    // ✅ Always works in v5
    const arrayBuffer = await response.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    console.log(`✅ [Aura] TTS Generated: ${buffer.length} bytes`);
    return buffer;

  } catch (error) {
    console.error("❌ Deepgram TTS Error:", error);
    return null;
  }
};
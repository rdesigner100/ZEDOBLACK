import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

const app = express();
const PORT = 3000;

app.use(express.json());

// xAI Chat Endpoint
app.post("/api/chat/xai", async (req, res) => {
  const { messages, systemInstruction, model } = req.body;
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ error: "XAI_API_KEY não configurada. Por favor, adicione-a nas variáveis de ambiente." });
  }

  // Base instructions for formatting and behavior
  const baseInstructions = `
Siga estas diretrizes de formatação e comportamento:
- Respostas sempre organizadas, limpas e bem formatadas usando Markdown.
- Coerência total com a mensagem do usuário.
- Se o usuário enviar saudações simples (ex: "oi", "olá") ou mensagens curtas, responda de forma simples, curta e direta.
- Responda de forma extensa apenas quando for estritamente necessário ou solicitado pelo usuário.
- Mantenha o tom solicitado nas instruções do sistema originais.
`;

  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n${baseInstructions}`
    : baseInstructions;

  try {
    const xaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.x.ai/v1",
    });

    const stream = await xaiClient.chat.completions.create({
      model: "grok-4-1-fast-non-reasoning", // Fixed to fastest/cheapest
      messages: [
        { role: "system", content: finalSystemInstruction },
        ...messages.map((m: any) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
      ],
      stream: true,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("xAI Error:", error);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ error: message });
  }
});

// AliveAI Proxy
const ALIVE_AI_BASE_URL = 'https://api.aliveai.app';

// Login Endpoint
app.post("/api/aliveai/login", async (req, res) => {
  try {
    const email = process.env.ALIVE_AI_EMAIL;
    const password = process.env.ALIVE_AI_PASSWORD;

    console.log("Login attempt for email:", email); // Debug log

    if (!email || !password) {
      console.error("Missing credentials on server");
      return res.status(500).json({ error: "AliveAI credentials not configured on server." });
    }

    const response = await fetch(`${ALIVE_AI_BASE_URL}/members/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AliveAI Login Failed (${response.status}):`, errorText);
      
      // If /members/login fails with 404, maybe it's just /login
      if (response.status === 404) {
          console.log("Trying fallback login endpoint: /login");
          const fallbackResponse = await fetch(`${ALIVE_AI_BASE_URL}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
          
          if (fallbackResponse.ok) {
              const data = await fallbackResponse.json();
              return res.json(data);
          }
          const fallbackError = await fallbackResponse.text();
          console.error(`Fallback Login Failed (${fallbackResponse.status}):`, fallbackError);
          return res.status(fallbackResponse.status).send(fallbackError);
      }
      
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("AliveAI Login Proxy Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Generic Proxy for other AliveAI endpoints
app.use("/api/aliveai", async (req, res) => {
  const targetUrl = `${ALIVE_AI_BASE_URL}${req.path}`;
  
  try {
    const options: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {}),
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`AliveAI Proxy Error (${req.path}):`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Image Proxy for authenticated AliveAI images
app.get("/api/aliveai-image", async (req, res) => {
  const imageUrl = req.query.url as string;
  const token = req.query.token as string;

  if (!imageUrl) {
    return res.status(400).send("Missing URL");
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://aliveai.app/create',
        'Origin': 'https://aliveai.app',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Sec-Ch-Ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      console.error(`Image Proxy Failed (${response.status}) for URL: ${imageUrl}`);
      return res.status(response.status).send("Failed to fetch image");
    }

    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Image Proxy Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (if needed, but usually handled by build output)
    // For this environment, we focus on dev mode mostly, but good to have placeholder
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

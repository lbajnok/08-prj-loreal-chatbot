// Find the chat elements on the page.
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

// Send chat requests to the deployed Cloudflare Worker.
const workerUrl = "https://loreal-chatbot.leahbajnok.workers.dev/";

// Keep the assistant focused on products across the L'Oréal Group portfolio.
const systemPrompt =
  "You are a knowledgeable L'Oréal beauty advisor for the full L'Oréal Group portfolio, including brands like L'Oréal Paris, Garnier, Maybelline, NYX Professional Makeup, Lancôme, Kiehl's, Biotherm, Ralph Lauren Fragrances, Redken, Matrix, Pureology, Essie, Armani Beauty, Mugler, and many more. Answer questions about beauty, skincare, haircare, makeup, fragrance, ingredients, routines, product comparisons, shopping advice, skin concerns, hair concerns, application tips, and personalized recommendations. Help with everyday beauty questions and common product questions across all L'Oréal brands. If the user asks for product suggestions, give clear recommendations based on skin type, skin tone, hair type, hair goals, budget, and occasion. Ask a short follow-up when the answer would be better with more detail such as skin type, tone, hair type, concern, or country. If a product name, shade, ingredient, price, or availability is uncertain, say so clearly and suggest checking the official brand website or the product packaging. Do not invent exact formulas, shade names, prices, product claims, or current availability. Focus only on L'Oréal Group beauty topics, skincare, makeup, hair, fragrance, routines, and beauty education. If someone asks something unrelated, politely explain that you can only help with beauty and L'Oréal products and invite them to ask a related beauty question.";

// Keep the conversation so the assistant can use earlier messages as context.
const messages = [{ role: "system", content: systemPrompt }];

// Add a message as text so user input is displayed safely.
function addMessage(className, text) {
  const message = document.createElement("p");
  message.className = `msg ${className}`;
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Wait a moment before retrying when the shared class worker is rate-limited.
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Show a greeting when the chat page first opens.
addMessage("ai", "Hello! How can I help you with L'Oréal products today?");

// Send each submitted message to the class Cloudflare Worker.
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) {
    return;
  }

  // Show only the current question and its response in the chat preview.
  chatWindow.replaceChildren();
  addMessage("user", userMessage);
  messages.push({ role: "user", content: userMessage });
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;

  let retryCount = 0;

  try {
    while (true) {
      const response = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      if (response.status === 429) {
        if (retryCount < 2) {
          retryCount += 1;
          addMessage("ai", "The assistant is getting a lot of requests right now. Retrying in a moment...");
          await wait(2000 * retryCount);
          continue;
        }

        throw new Error(
          "The chat service is rate-limited right now. Please wait a minute and try again."
        );
      }

      if (!response.ok) {
        throw new Error(`The chat service returned status ${response.status}.`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "The deployed Worker is not returning chat responses yet. It may still be using the default Hello World code."
        );
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;

      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("The chat service returned an unexpected response.");
      }

      addMessage("ai", reply);
      messages.push({ role: "assistant", content: reply });
      break;
    }
  } catch (error) {
    console.error("Chat request failed:", error);
    addMessage("ai", `Sorry, I couldn't get a reply. ${error.message}`);
    messages.pop();
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
});

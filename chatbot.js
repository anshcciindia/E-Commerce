(function () {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button id="chatToggle" class="chat-toggle" type="button" aria-expanded="false" aria-controls="chatPanel">
      <span class="chat-toggle-icon" aria-hidden="true">✦</span>
      <span class="chat-toggle-copy"><strong>Ask Bazaar</strong><small>Your shopping sidekick</small></span>
    </button>
    <section id="chatPanel" class="chat-panel" aria-label="Shopping assistant" hidden>
      <div class="chat-head">
        <span class="chat-avatar" aria-hidden="true">b.</span>
        <div class="chat-title"><strong>Bazaar assistant</strong><span>Here to make shopping easier</span></div>
        <span class="chat-presence"><i></i> Ready</span>
        <button id="chatClose" type="button" aria-label="Close chat">×</button>
      </div>
      <div id="chatLog" class="chat-log" role="log" aria-live="polite"></div>
      <div id="chatChips" class="chat-chips"></div>
      <form id="chatForm" class="chat-form">
        <label class="sr" for="chatInput">Type your question</label>
        <input id="chatInput" autocomplete="off" maxlength="2000" placeholder="Ask me anything…">
        <button id="chatSend" type="submit" aria-label="Send message"><span>Send</span><b aria-hidden="true">↑</b></button>
      </form>
      <div class="chat-footnote"><span aria-hidden="true">✦</span> Bazaar AI can make mistakes. Check product details before buying.</div>
    </section>`;
  document.body.appendChild(wrap);

  const log = document.getElementById("chatLog");
  const panel = document.getElementById("chatPanel");
  const toggle = document.getElementById("chatToggle");
  const input = document.getElementById("chatInput");
  const sendButton = document.getElementById("chatSend");
  const history = [];
  let busy = false;

  function remember(role, content) {
    history.push({ role, content });
    if (history.length > 12) history.splice(0, history.length - 12);
  }

  function add(text, who) {
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    remember(who === "user" ? "user" : "assistant", text);
    return d;
  }

  function addProducts(items) {
    const d = document.createElement("div");
    d.className = "msg bot list";
    items.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = p.emoji + " " + p.name + " · " + inr(p.price) + " (" + off(p) + "% off)";
      b.onclick = () => openModal(p.id);
      d.appendChild(b);
    });
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    remember("assistant", "Suggested products: " + items.map(p => `${p.name} at ${inr(p.price)}`).join(", "));
  }

  function storeContext() {
    const products = PRODUCTS.map(p =>
      `${p.name} (${p.cat}): ${inr(p.price)}, ${p.rating} stars. ${p.desc}`
    ).join("\n");
    const cart = Object.entries(state.cart)
      .map(([id, quantity]) => {
        const product = PRODUCTS.find(p => p.id === Number(id));
        return product ? `${quantity} × ${product.name} (${inr(product.price)} each)` : null;
      })
      .filter(Boolean);
    return `Catalog:\n${products}\nCart: ${cart.length ? cart.join(", ") : "empty"}\nStore policies: Free delivery on orders over ₹499. The storefront advertises 7-day easy returns. This is a demo store: no real orders, payment processing, or order tracking are available.`;
  }

  async function askAi() {
    const thinking = document.createElement("div");
    thinking.className = "msg bot typing";
    thinking.setAttribute("aria-label", "Bazaar is thinking");
    thinking.innerHTML = '<span>Thinking</span><i></i><i></i><i></i>';
    log.appendChild(thinking);
    sendButton.disabled = true;
    input.disabled = true;
    busy = true;

    try {
      const messages = history.slice(-12);
      while (messages.length && messages[0].role !== "user") messages.shift();
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].role === messages[i - 1].role) {
          messages[i - 1].content += "\n" + messages[i].content;
          messages.splice(i, 1);
          i--;
        }
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          storeContext: storeContext()
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Chat request failed (${response.status}).`);
      if (typeof result.reply !== "string" || !result.reply.trim()) {
        throw new Error("The AI assistant returned an empty reply. Please try again.");
      }
      thinking.textContent = result.reply;
      remember("assistant", result.reply);
    } catch (error) {
      thinking.textContent = error.message || "I couldn't reach the AI assistant. Please try again.";
      thinking.classList.add("error");
      remember("assistant", thinking.textContent);
    } finally {
      busy = false;
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
      log.scrollTop = log.scrollHeight;
    }
  }

  const STOP = new Set(["show","find","want","need","for","the","some","any","best","cheap","good","with","under","below","and","please","me","get","buy","looking","have","you","are","what","can","your","about","product","products"]);

  function reply(raw) {
    const q = raw.toLowerCase();
    if (/^(hi|hello|hey|namaste)\b/.test(q)) return add("Hi! I'm the Bazaar AI assistant. Ask me about products, shopping, or anything you'd like help with.", "bot");
    if (/\b(joke|funny|make me laugh)\b/.test(q)) return add("Why did the shopper bring a ladder to Bazaar? They heard the best deals were on another level!", "bot");
    if (/deliver|shipping|ship|how long/.test(q)) return add("Delivery is free on orders over ₹499. This demo store doesn't provide live delivery estimates.", "bot");
    if (/return|refund|exchange|replace/.test(q)) return add("The store advertises 7-day easy returns. This is a demo, so no real orders or refunds are processed.", "bot");
    if (/pay|upi|card|cod|cash|emi/.test(q)) return add("This is a demo store and does not process payments or take real orders.", "bot");
    if (/track|order status|where is my order/.test(q)) return add("This is a demo store, so there are no real orders to track.", "bot");
    if (/cart|basket|bag total/.test(q)) {
      const rows = Object.entries(state.cart).map(([id, n]) => ({ p: PRODUCTS.find(x => x.id === +id), n })).filter(r => r.p);
      if (!rows.length) return add("Your cart is empty right now. Ask me for deals or a product to get started.", "bot");
      const total = rows.reduce((s, r) => s + r.n * r.p.price, 0);
      return add("In your cart: " + rows.map(r => r.n + " × " + r.p.name).join(", ") + ". Subtotal: " + inr(total) + ".", "bot");
    }
    if (/deal|offer|discount|sale/.test(q)) {
      add("Here are the biggest discounts right now:", "bot");
      return addProducts([...PRODUCTS].sort((a, b) => off(b) - off(a)).slice(0, 4));
    }
    const budget = q.match(/(?:under|below|less than|within)\s*₹?\s*(\d+)/);
    const words = q.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).map(w => w.replace(/s$/, ""));
    const found = PRODUCTS.filter(p => {
      const hay = (p.name + " " + p.cat + " " + p.desc).toLowerCase();
      const wordOk = words.length === 0 || words.some(w => hay.includes(w));
      const priceOk = !budget || p.price <= +budget[1];
      return wordOk && priceOk;
    });
    if ((words.length || budget) && found.length) {
      add("Here's what I found:", "bot");
      return addProducts(found.slice(0, 4));
    }
    return askAi();
  }

  function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    add(trimmed, "user");
    reply(trimmed);
  }

  function showWelcome() {
    const welcome = document.createElement("div");
    welcome.className = "chat-welcome";
    welcome.innerHTML = `
      <span class="welcome-spark" aria-hidden="true">✦</span>
      <p class="welcome-eyebrow">YOUR BAZAAR SHOPPING GUIDE</p>
      <h3>Hi there! What can I help you find?</h3>
      <p class="welcome-copy">Browse the store, find a deal, or just ask me anything.</p>
      <div class="welcome-prompts" aria-label="Try asking">`;
    [
      ["Find me a gift", "Help me find a gift under ₹1000"],
      ["Tell me a joke", "Tell me a joke"],
      ["Today's deals", "Show deals"]
    ].forEach(([label, question]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.onclick = () => send(question);
      welcome.querySelector(".welcome-prompts").appendChild(button);
    });
    welcome.insertAdjacentHTML("beforeend", "</div>");
    log.appendChild(welcome);
  }

  ["Show deals", "Delivery info", "Return policy", "Under ₹1000"].forEach(label => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = () => send(label === "Under ₹1000" ? "products under 1000" : label);
    document.getElementById("chatChips").appendChild(b);
  });

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      if (!log.children.length) showWelcome();
      input.focus();
    }
  }

  toggle.onclick = () => setOpen(panel.hidden);
  document.getElementById("chatClose").onclick = () => { setOpen(false); toggle.focus(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) setOpen(false); });
  document.getElementById("chatForm").onsubmit = e => {
    e.preventDefault();
    send(input.value);
    input.value = "";
  };
})();

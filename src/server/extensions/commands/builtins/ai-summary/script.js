(function () {
  const glanceEl = document.getElementById("at-a-glance");
  if (!glanceEl) return;

  /** @type {{ role: string; content: string }[]} */
  let history = [];

  function getQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  }

  function buildResultsContext() {
    const items = document.querySelectorAll("#results-list .result");
    const out = [];
    let i = 0;
    for (const el of items) {
      if (i >= 6) break;
      const title = el.querySelector(".result-title")?.textContent?.trim() || "";
      const snippet =
        el.querySelector(".result-snippet")?.textContent?.trim() || "";
      if (title || snippet) {
        i++;
        out.push("[" + i + "] " + title + "\n" + snippet);
      }
    }
    return out.join("\n\n");
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

  function handleSetup(box) {
    const diveBtn = box.querySelector(".glance-ai-dive");
    const chatWrap = box.querySelector(".glance-ai-chat");
    const input = box.querySelector(".glance-ai-input");
    const messagesEl = box.querySelector(".glance-ai-messages");
    if (!diveBtn || !chatWrap || !input || !messagesEl) return;

    const snippet = box.querySelector(".glance-snippet");
    const query = getQuery();
    const context = buildResultsContext();

    history = [
      {
        role: "system",
        content:
          "You are a helpful assistant. The user searched for: " +
          JSON.stringify(query) +
          ". Here are the search results for context:\n\n" +
          context +
          "\n\nYou already gave a summary. Now the user wants to dive deeper. Answer their follow-up questions conversationally and concisely.",
      },
      {
        role: "assistant",
        content: snippet ? snippet.textContent || "" : "",
      },
    ];

    diveBtn.addEventListener("click", function () {
      diveBtn.hidden = true;
      chatWrap.hidden = false;
      input.focus();
    });

    input.addEventListener("input", function () {
      autoResize(input);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input, messagesEl, chatWrap);
      }
    });
  }

  async function sendMessage(input, messagesEl, chatWrap) {
    const text = input.value.trim();
    if (!text) return;

    const userDiv = document.createElement("div");
    userDiv.className = "glance-ai-reply glance-ai-user";
    userDiv.textContent = text;
    messagesEl.appendChild(userDiv);

    history.push({ role: "user", content: text });
    input.value = "";
    autoResize(input);

    const typingDiv = document.createElement("div");
    typingDiv.className = "glance-ai-typing";
    typingDiv.textContent = "Thinking\u2026";
    messagesEl.appendChild(typingDiv);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      typingDiv.remove();

      if (data.reply) {
        history.push({ role: "assistant", content: data.reply });
        const replyDiv = document.createElement("div");
        replyDiv.className = "glance-ai-reply";
        replyDiv.textContent = data.reply;
        messagesEl.appendChild(replyDiv);
      } else {
        const errDiv = document.createElement("div");
        errDiv.className = "glance-ai-typing";
        errDiv.textContent = "Could not get a response. Try again.";
        messagesEl.appendChild(errDiv);
      }
    } catch {
      typingDiv.remove();
      const errDiv = document.createElement("div");
      errDiv.className = "glance-ai-typing";
      errDiv.textContent = "Request failed. Try again.";
      messagesEl.appendChild(errDiv);
    }

    input.focus();
  }

  const observer = new MutationObserver(function () {
    const box = glanceEl.querySelector(".glance-ai");
    if (box && !box.dataset.chatInit) {
      box.dataset.chatInit = "1";
      handleSetup(box);
    }
  });
  observer.observe(glanceEl, { childList: true, subtree: true });

  const existing = glanceEl.querySelector(".glance-ai");
  if (existing && !existing.dataset.chatInit) {
    existing.dataset.chatInit = "1";
    handleSetup(existing);
  }
})();

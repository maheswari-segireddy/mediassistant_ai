async function testApi() {
  try {
    const res = await fetch("https://mediassistant-ai-git-main-maheswaris-projects-7c172090.vercel.app/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    console.log("Body:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
testApi();

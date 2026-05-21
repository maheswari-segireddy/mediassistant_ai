async function testLarge() {
  const url = "https://mediassistant-ai.vercel.app/api/chat";
  const largeString = "A".repeat(5 * 1024 * 1024); // 5 MB string
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: largeString }] })
    });
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
testLarge();

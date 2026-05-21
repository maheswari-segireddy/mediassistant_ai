async function testLocalApi() {
  try {
    const res = await fetch("http://localhost:5000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        system: "test", 
        messages: [{ role: "user", content: "hello" }] 
      })
    });
    console.log("Local Status:", res.status);
    const text = await res.text();
    console.log("Local Body:", text);
  } catch (e) {
    console.error("Local Fetch failed:", e.message);
  }
}
testLocalApi();

async function testSize(sizeMB) {
  const url = "https://mediassistant-ai.vercel.app/api/chat";
  const sizeBytes = sizeMB * 1024 * 1024;
  const largeString = "A".repeat(sizeBytes);
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        system: "test", 
        messages: [{ role: "user", content: largeString }] 
      })
    });
    console.log(`Payload: ${sizeMB}MB -> Status: ${res.status}`);
    if (res.status >= 400 && res.status < 500) {
        console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
    }
  } catch (e) {
    console.error(`Payload: ${sizeMB}MB -> Fetch failed:`, e.message);
  }
}

async function run() {
    await testSize(0.5); // 500KB
    await testSize(2);   // 2MB
}
run();

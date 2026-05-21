async function checkVercelHtml() {
  try {
    const res = await fetch("https://mediassistant-ai.vercel.app/");
    const html = await res.text();
    console.log("HTML length:", html.length);
    if (html.includes("Cache-Control")) {
      console.log("YES! Cache-busting meta tags exist. Vercel built the new commit.");
    } else {
      console.log("NO! Vercel did NOT build the new commit.");
    }
  } catch(e) {
    console.error(e);
  }
}
checkVercelHtml();

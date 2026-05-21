async function checkBundle() {
  const htmlRes = await fetch("https://mediassistant-ai.vercel.app/");
  const html = await htmlRes.text();
  const jsMatch = html.match(/src="\/assets\/(index-[^"]+\.js)"/);
  const jsUrl = "https://mediassistant-ai.vercel.app/assets/" + jsMatch[1];
  const jsRes = await fetch(jsUrl);
  const jsCode = await jsRes.text();
  const index = jsCode.indexOf("localhost:5000");
  if (index !== -1) {
    console.log("Found at index", index);
    console.log("Context:", jsCode.substring(index - 50, index + 50));
  }
}
checkBundle();

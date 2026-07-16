import puppeteer from "puppeteer-core";

const url = process.argv[2];
const out = process.argv[3] || "/tmp/shot.png";
const mode = process.argv[4] || "desktop";
const cookies = process.argv[5]; // optional "site_lang=en"

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport(
  mode === "mobile"
    ? { width: 390, height: 844, deviceScaleFactor: 2 }
    : { width: 1440, height: 900, deviceScaleFactor: 2 },
);
if (cookies) {
  const [name, value] = cookies.split("=");
  const u = new URL(url);
  await page.setCookie({ name, value, domain: u.hostname, path: "/" });
}
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: out, fullPage: mode !== "viewport" });
await browser.close();
console.log("saved", out);

// =============================
// Zenchef Checker – Railway + Make
// =============================
const express = require('express');
const { chromium } = require('playwright');
const twilio = require('twilio');
// =============================
// VARIABLES D'ENVIRONNEMENT
// =============================
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY; // pour sécuriser l'endpoint
const app = express();
// =============================
// PAGE RACINE
// =============================
app.get('/', (req, res) => {
  res.send("Zenchef Checker actif ✅ Utilise /check");
});
// =============================
// ENDPOINT PRINCIPAL
// =============================
app.get('/check', async (req, res) => {
  try {
    const nextNotOpenDay = await runScraping();
    if (!nextNotOpenDay) {
      return res.json({ status: "ok", nextNotOpenDay: null });
    }
    res.json({
      status: "ok",
      nextNotOpenDay: nextNotOpenDay
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Scraping failed" });
  }
});
// =============================
// FONCTION SCRAPING
// =============================
async function runScraping() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    console.log("🚀 Ouverture page Zenchef...");
    await page.goto(
      'https://bookings.zenchef.com/results?rid=361825&pid=1001',
      { waitUntil: 'networkidle', timeout: 60000 }
    );
    await page.waitForTimeout(4000);

    console.log(" Click sur le bouton pour ouvrir le calendar...");
    // ✅ CHANGEMENT : le calendrier est dans un accordion, on l'ouvre via dispatchEvent
    // pour éviter que les éléments superposés interceptent le clic
    const buttons = await page.$$('button');
    const visibleButtons = [];
    for (const btn of buttons) {
      if (await btn.isVisible().catch(() => false)) visibleButtons.push(btn);
    }
    const secondButton = visibleButtons[1];
    await secondButton.dispatchEvent('click');
    await page.waitForTimeout(2000);

    console.log(" Récupère la 1e date notOpenYet");
    async function findNextNotOpenDay() {
      const element = await page.$('.DayPicker-Day--notOpenYet');
      if (!element) return null;
      return (await element.getAttribute('aria-label')) || (await element.innerText());
    }
    console.log("🔎 Recherche mois courant...");
    let nextNotOpenDay = await findNextNotOpenDay();
    if (!nextNotOpenDay) {
      console.log("➡ Passage au mois suivant...");
      // ✅ CHANGEMENT : dispatchEvent au lieu de click() pour éviter l'interception
      const nextBtn = await page.$('[data-testid="calendar-next-month-btn"]');
      await nextBtn.dispatchEvent('click');
      await page.waitForTimeout(3000);
      nextNotOpenDay = await findNextNotOpenDay();
    }
    return nextNotOpenDay;
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Navigateur fermé.");
    }
  }
}
// =============================
// LANCEMENT SERVEUR
// =============================
app.listen(PORT, () => {
  console.log(`🌍 Zenchef Checker running on port ${PORT}`);
});
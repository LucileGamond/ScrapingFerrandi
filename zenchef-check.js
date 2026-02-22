// =============================
// Zenchef Checker – Railway + Make
// =============================

const express = require('express');
const { chromium } = require('playwright');
const twilio = require('twilio');

// =============================
// VARIABLES D'ENVIRONNEMENT
// =============================
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM;
const TO = process.env.TWILIO_TO;
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY; // pour sécuriser l’endpoint

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
const app = express();

// =============================
// PAGE RACINE
// =============================
app.get('/', (req, res) => {
  res.send("Zenchef Checker actif ✅ Utilise /check?key=SECRET_KEY");
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
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await page.waitForTimeout(4000);

    async function findNextNotOpenDay() {
      const element = await page.$('.DayPicker-Day--notOpenYet');
      if (!element) return null;
      return (await element.getAttribute('aria-label')) || (await element.innerText());
    }

    console.log("🔎 Recherche mois courant...");
    let nextNotOpenDay = await findNextNotOpenDay();

    if (!nextNotOpenDay) {
      console.log("➡ Passage au mois suivant...");
      await page.click('[data-testid="calendar-next-month-btn"]');
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
// =============================
// Zenchef Checker - Railway Ready
// =============================

const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const twilio = require('twilio');

// =============================
// VARIABLES D'ENVIRONNEMENT
// =============================
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM;
const TO = process.env.TWILIO_TO;
const PORT = process.env.PORT || 3000;

// Vérification sécurité
if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM || !TO) {
  console.error("❌ Variables d'environnement manquantes !");
}

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
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
  res.send("Scraping lancé ✅");
  runScraping(); // Lancement en arrière-plan
});

// =============================
// ENDPOINT RESET
// =============================
app.get('/reset', (req, res) => {
  if (fs.existsSync('last.txt')) {
    fs.unlinkSync('last.txt');
  }
  res.send("last.txt supprimé ✅");
});

// =============================
// FONCTION SCRAPING
// =============================
async function runScraping() {
  let browser;

  try {
    console.log("🚀 Lancement du scraping...");

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.goto(
      'https://bookings.zenchef.com/results?rid=361825&pid=1001',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await page.waitForTimeout(4000);

    async function findNextNotOpenDay() {
      const element = await page.$('.DayPicker-Day--notOpenYet');
      if (!element) return null;
      return (
        (await element.getAttribute('aria-label')) ||
        (await element.innerText())
      );
    }

    console.log("🔎 Recherche mois courant...");
    let nextNotOpenDay = await findNextNotOpenDay();

    if (!nextNotOpenDay) {
      console.log("➡ Passage au mois suivant...");
      await page.click('[data-testid="calendar-next-month-btn"]');
      await page.waitForTimeout(3000);
      nextNotOpenDay = await findNextNotOpenDay();
    }

    if (!nextNotOpenDay) {
      console.log("❌ Aucun jour trouvé.");
      return;
    }

    console.log("📅 Jour trouvé :", nextNotOpenDay);

    const last = fs.existsSync('last.txt')
      ? fs.readFileSync('last.txt', 'utf8')
      : '';

    if (nextNotOpenDay !== last) {
      console.log("🔔 Nouveau jour détecté !");
      fs.writeFileSync('last.txt', nextNotOpenDay);

      await client.messages.create({
        from: FROM,
        to: TO,
        body: `📅 Nouveau créneau Zenchef disponible : ${nextNotOpenDay}`
      });

      console.log("✅ Notification WhatsApp envoyée !");
    } else {
      console.log("ℹ️ Aucun changement.");
    }

  } catch (error) {
    console.error("❌ Erreur scraping :", error);
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
  console.log(`🌍 Serveur démarré sur le port ${PORT}`);
});
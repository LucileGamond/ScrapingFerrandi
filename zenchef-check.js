// Modules nécessaires
const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const twilio = require('twilio');

// Configuration via variables d’environnement
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM;
const TO = process.env.TWILIO_TO;
const PORT = process.env.PORT || 3000;

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

// Crée le serveur Express
const app = express();

// Endpoint HTTP déclenchable par Make
app.get('/check', async (req, res) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("Ouverture de la page Zenchef...");
    await page.goto('https://bookings.zenchef.com/results?rid=361825&pid=1001', { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);

    async function findNextNotOpenDay() {
      const element = await page.$('.DayPicker-Day--notOpenYet');
      if (!element) return null;
      return await element.getAttribute('aria-label') || await element.innerText();
    }

    console.log("Recherche du prochain jour non ouvert dans le mois courant...");
    let nextNotOpenDay = await findNextNotOpenDay();

    if (!nextNotOpenDay) {
      console.log("Aucun jour trouvé ce mois, passage au mois suivant...");
      await page.click('[data-testid="calendar-next-month-btn"]');
      await page.waitForTimeout(3000);
      nextNotOpenDay = await findNextNotOpenDay();
    }

    await browser.close();

    if (!nextNotOpenDay) {
      console.log("Aucun jour notOpenYet trouvé sur les deux mois.");
      res.send("Aucun jour non ouvert trouvé");
      return;
    }

    console.log("Prochain jour non ouvert :", nextNotOpenDay);

    const last = fs.existsSync('last.txt') ? fs.readFileSync('last.txt', 'utf8') : '';

    if (nextNotOpenDay !== last) {
      console.log("Changement détecté !");
      fs.writeFileSync('last.txt', nextNotOpenDay);

      await client.messages.create({
        from: FROM,
        to: TO,
        body: `Le prochain jour non ouvert est maintenant réservable : ${nextNotOpenDay}`
      });

      console.log("Notification envoyée !");
    } else {
      console.log("Aucun changement.");
    }

    res.send(`Prochain jour non ouvert : ${nextNotOpenDay}`);
  } catch (err) {
    await browser.close();
    console.error("Erreur :", err);
    res.status(500).send("Erreur lors de la vérification Zenchef");
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Zenchef checker running on http://localhost:${PORT}/check`);
});
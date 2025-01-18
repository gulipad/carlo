const express = require("express");
const { handleUserMessage } = require("../services/botService");
const router = express.Router();
require("dotenv").config();

// Webhook verification
router.get("/webhook", (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  // Check the token from the query params
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verifyToken) {
    console.log("Webhook verified successfully");
    res.status(200).send(challenge); // Respond with the challenge to complete verification
  } else {
    console.error("Webhook verification failed");
    res.sendStatus(403); // Forbidden if token doesn't match
  }
});

router.post("/webhook", async (req, res) => {
  const { entry } = req.body;

  try {
    const changes = entry?.[0]?.changes?.[0];
    const messageData = changes?.value?.messages?.[0];

    if (!messageData) {
      console.log("No message found in the webhook payload.");
      return res.sendStatus(200);
    }

    const phoneNumber = messageData.from; // Sender's phone number
    const message = messageData.text?.body || ""; // Message content

    console.log(`Received message from ${phoneNumber}: ${message}`);
    await handleUserMessage(phoneNumber, message);

    res.sendStatus(200);
  } catch (error) {
    console.error("Error handling webhook:", error.message);
    res.sendStatus(500);
  }
});

module.exports = router;

const { sendWhatsAppMessage } = require("../services/whatsAppService");

(async () => {
  try {
    const recipient = "+34648545124"; // Replace with your phone number
    const message = "Hello! This is a test message from your app.";
    await sendWhatsAppMessage(recipient, message);
  } catch (error) {
    console.error("Test failed:", error.message);
  }
})();

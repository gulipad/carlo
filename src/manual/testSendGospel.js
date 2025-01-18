const { sendGospelMessage } = require("../services/whatsAppService");

(async () => {
  try {
    const recipient = "+34648545124"; // Replace with your phone number
    const date = new Date().toISOString().split("T")[0]; // Today's date
    await sendGospelMessage(recipient, date);
  } catch (error) {
    console.error("Test failed:", error.message);
  }
})();

// traffic.js
const BASE_URL = 'http://localhost:3000';
const PHONE_IDS = [1, 2, 3];

// Helper to pick a random phone ID
const getRandomPhoneId = () => PHONE_IDS[Math.floor(Math.random() * PHONE_IDS.length)];

// Helper to wait for a random amount of time (between 100ms and 800ms)
const randomDelay = () => new Promise(res => setTimeout(res, Math.floor(Math.random() * 700) + 100));

async function simulatePurchase() {
  const phoneId = getRandomPhoneId();
  try {
    const response = await fetch(`${BASE_URL}/api/buy/${phoneId}`, { method: 'POST' });
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success: Bought Phone ID ${phoneId} - ${data.message}`);
    } else {
      console.log(`❌ Failed: Phone ID ${phoneId} - ${data.error}`);
    }
  } catch (err) {
    console.error(`⚠️ Network Error: Could not reach the server.`);
  }
}

async function startTrafficGenerator() {
  console.log('🚀 Starting Traffic Generator... Press Ctrl+C to stop.');
  
  // Run infinitely
  while (true) {
    // Fire off a purchase request
    simulatePurchase();
    
    // Wait a fraction of a second before the next user "clicks"
    await randomDelay();
  }
}

startTrafficGenerator();
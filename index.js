const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
require('dotenv').config();

// Firebase (keep as you have)
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "dhaba-bot" }),   // Helps with session
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-extensions'
    ],
    executablePath: '/usr/bin/google-chrome-stable'   // GitHub runner has Chrome
  },
  // Fix for recent WhatsApp Web changes
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.0.html'   // Update if needed
  }
});

client.on('qr', (qr) => {
  console.log('\n🔥 SCAN THIS QR CODE WITH YOUR WHATSAPP APP:\n');
  qrcode.generate(qr, { 
    small: false,     // Bigger QR = easier to scan
    scale: 8 
  });
  console.log('\nIf the QR is still hard to scan, copy the text below and use an online QR generator:\n');
  console.log(qr);   // This prints the raw QR string
});

client.on('ready', () => {
  console.log('✅ Dhaba WhatsApp Bot is successfully connected and online!');
});

client.on('authenticated', () => {
  console.log('🔐 Session authenticated successfully!');
});

// Your message handler (keep your existing hi/menu/order logic here)
client.on('message', async (msg) => {
  const text = msg.body.toLowerCase().trim();
  // ... your existing code for hi, menu, order ...
});

client.initialize();

console.log('🚀 Starting Dhaba Bot on GitHub Actions...');

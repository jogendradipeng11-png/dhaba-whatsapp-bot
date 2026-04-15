const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
require('dotenv').config();

// === Firebase Setup ===
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "dhaba-bot" }),
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
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  console.log('\n🔥 === SCAN THIS QR WITH YOUR WHATSAPP ===\n');
  qrcode.generate(qr, { small: false });   // Big QR for easy scanning
  console.log('\nIf QR is hard to scan, copy the string below and use online QR generator:\n');
  console.log(qr);
});

client.on('ready', () => {
  console.log('\n✅ Dhaba WhatsApp Bot is ONLINE and Ready!');
});

client.on('authenticated', () => {
  console.log('🔐 Session authenticated successfully!');
});

client.on('message', async (msg) => {
  const text = msg.body.toLowerCase().trim();

  if (text === 'hi' || text === 'hello' || text === 'namaste') {
    await msg.reply(`👋 *Welcome to Dhaba Bot!*\n\nType *menu* to see today's menu 🍛`);
  } 
  else if (text === 'menu') {
    await msg.reply(`🍛 *Dhaba Special Menu Today*\n\n1. Butter Chicken + 2 Roti - ₹180\n2. Dal Makhani + Rice - ₹150\n3. Paneer Butter Masala - ₹200\n4. Special Veg Thali - ₹220\n5. Chicken Biryani - ₹250\n\nReply with: *order 1*`);
  } 
  else if (text.startsWith('order')) {
    const item = text.replace('order', '').trim();
    await db.collection('orders').add({
      phone: msg.from,
      item: item,
      status: 'Received',
      time: new Date().toISOString()
    });
    await msg.reply(`✅ *Order Received!*\nItem ${item} is being prepared.\nThank you for ordering from Dhaba! 🙏`);
  } 
  else {
    await msg.reply('Sorry, I didn\'t understand.\nType *menu* or *hi* to start.');
  }
});

client.initialize();

console.log('🚀 Dhaba Bot is starting...');

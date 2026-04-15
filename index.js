const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
require('dotenv').config();

// Firebase setup (keep as before)
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',     // Important for GitHub Actions
      '--disable-gpu'
    ]
  }
});

client.on('qr', qr => {
  console.log('📱 Scan this QR code with WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Dhaba WhatsApp Bot is Online and Ready!');
});

client.on('message', async (msg) => {
  // Your existing message handler code here (hi, menu, order etc.)
  const text = msg.body.toLowerCase().trim();

  if (text === 'hi' || text === 'hello' || text === 'namaste') {
    await msg.reply(`👋 *Welcome to Dhaba Bot!*\n\nType *menu* to see today's menu 🍛`);
  } 
  else if (text === 'menu') {
    await msg.reply(`🍛 *Dhaba Special Menu Today*\n\n1. Butter Chicken + 2 Roti - ₹180\n2. Dal Makhani + Rice - ₹150\n3. Paneer Butter Masala - ₹200\n4. Special Veg Thali - ₹220\n5. Chicken Biryani - ₹250\n\nReply: *order 1*`);
  } 
  else if (text.startsWith('order')) {
    const item = text.replace('order', '').trim();
    await db.collection('orders').add({
      phone: msg.from,
      item: item,
      status: 'Received',
      time: new Date().toISOString()
    });
    await msg.reply(`✅ Order Received! Item ${item} is being prepared. Thank you! 🙏`);
  } 
  else {
    await msg.reply('Type *menu* or *hi* to start.');
  }
});

client.initialize();

console.log('🚀 Bot is starting...');

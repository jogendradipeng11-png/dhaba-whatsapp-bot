require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const mysql = require('mysql2/promise');
const express = require('express');
const pino = require('pino');

const logger = pino({ level: 'silent' });

const app = express();
app.get('/health', (req, res) => res.send('✅ Dhaba WhatsApp Bot is Alive!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Health server running on port ${PORT}`));

async function connectDB() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    console.log('✅ Connecting to database using DATABASE_URL');
    // Supports full URL like: mysql://user:pass@host/dbname
    return await mysql.createConnection(databaseUrl);
  } else {
    // Fallback if you still use individual secrets
    console.log('✅ Connecting using separate DB variables');
    return await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
  }
}

async function initDB(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    whatsapp_number VARCHAR(50) NOT NULL,
    item VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const [rows] = await db.execute('SELECT COUNT(*) as count FROM menu');
  if (rows[0].count === 0) {
    await db.execute(`INSERT INTO menu (item, price) VALUES 
      ('Butter Chicken', 150.00),
      ('Dal Makhani', 120.00),
      ('Paneer Butter Masala', 140.00),
      ('Naan', 30.00),
      ('Jeera Rice', 80.00),
      ('Gulab Jamun', 60.00),
      ('Roti', 20.00),
      ('Lassi', 50.00)`);
    console.log('✅ Default Dhaba menu inserted successfully!');
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n🔥 SCAN THIS QR CODE WITH WHATSAPP:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('🔄 Reconnecting WhatsApp Bot...');
        setTimeout(startBot, 5000); // small delay before reconnect
      } else {
        console.log('❌ Logged out. Delete "auth_info" folder and restart.');
      }
    }

    if (connection === 'open') {
      console.log('✅ Dhaba WhatsApp Bot Connected Successfully!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    let text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();

    const db = await connectDB();

    if (text === 'menu' || text === 'menu please') {
      const [rows] = await db.execute('SELECT * FROM menu');
      let reply = '🍽️ *Welcome to Dhaba*\n\n*Our Menu:*\n\n';
      rows.forEach(row => {
        reply += `• ${row.item} → ₹${row.price}\n`;
      });
      reply += '\nSend: *order Butter Chicken 2*';
      await sock.sendMessage(from, { text: reply });
    } 
    else if (text.startsWith('order')) {
      const parts = text.split(' ').slice(1);
      let qty = 1;
      if (!isNaN(parts[parts.length - 1])) {
        qty = parseInt(parts.pop());
      }
      const itemName = parts.join(' ');

      const [menuRows] = await db.execute('SELECT * FROM menu WHERE LOWER(item) LIKE ?', [`%${itemName.toLowerCase()}%`]);

      if (menuRows.length > 0) {
        const item = menuRows[0].item;
        await db.execute('INSERT INTO orders (whatsapp_number, item, quantity) VALUES (?, ?, ?)', 
          [from, item, qty]);

        await sock.sendMessage(from, { 
          text: `✅ *Order Placed Successfully!*\n\n${qty} × ${item}\nStatus: *Pending*\n\nThank you for ordering from Dhaba!` 
        });
      } else {
        await sock.sendMessage(from, { text: '❌ Item not found.\nSend *menu* to see available items.' });
      }
    } 
    else {
      await sock.sendMessage(from, { 
        text: '👋 Hello! Welcome to Dhaba\n\nSend *menu* to see the menu\nor type:\n*order <item> <quantity>*\nExample: order dal makhani 2' 
      });
    }

    await db.end();
  });
}

async function main() {
  try {
    const db = await connectDB();
    await initDB(db);
    await db.end();
    console.log('✅ Database initialized successfully');
    startBot();
  } catch (err) {
    console.error('❌ Failed to start bot:', err.message);
  }
}

main();

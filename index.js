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
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      console.log('🔗 Trying to connect using DATABASE_URL...');
      console.log('URL starts with:', databaseUrl.substring(0, 40) + '...'); // hide password
      const connection = await mysql.createConnection(databaseUrl);
      console.log('✅ Database connected successfully using URL!');
      return connection;
    } else {
      console.log('⚠️ DATABASE_URL not found, trying individual variables...');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }   // Helps with many free hosts
      });
      console.log('✅ Database connected using individual variables!');
      return connection;
    }
  } catch (err) {
    console.error('❌ DATABASE CONNECTION FAILED!');
    console.error('Error Message:', err.message);
    console.error('Error Code:', err.code);
    console.error('Full Error:', err);
    throw err;   // Let main() catch it
  }
}

async function initDB(db) {
  console.log('⏳ Initializing database tables...');
  await db.execute(`CREATE TABLE IF NOT EXISTS menu (...)`); // your table code
  await db.execute(`CREATE TABLE IF NOT EXISTS orders (...)`);

  const [rows] = await db.execute('SELECT COUNT(*) as count FROM menu');
  if (rows[0].count === 0) {
    await db.execute(`INSERT INTO menu (item, price) VALUES 
      ('Butter Chicken', 150.00), ('Dal Makhani', 120.00), ('Paneer Butter Masala', 140.00),
      ('Naan', 30.00), ('Jeera Rice', 80.00), ('Gulab Jamun', 60.00), ('Roti', 20.00), ('Lassi', 50.00)`);
    console.log('✅ Sample menu inserted!');
  }
  console.log('✅ Database ready!');
}

// Rest of the code (startBot + main) remains same as before
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
      console.log('\n🔥 SCAN THIS QR CODE WITH WHATSAPP APP:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(startBot, 5000);
      }
    }
    if (connection === 'open') {
      console.log('✅ WhatsApp Bot Connected Successfully for Dhaba!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // messages.upsert handler (same as previous version)
  sock.ev.on('messages.upsert', async (m) => {
    // ... (keep the full message handler from my previous response)
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    let text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();

    const db = await connectDB();

    if (text === 'menu' || text === 'menu please') {
      const [rows] = await db.execute('SELECT * FROM menu');
      let reply = '🍽️ *Welcome to Dhaba*\n\n*Our Menu:*\n\n';
      rows.forEach(row => reply += `• ${row.item} → ₹${row.price}\n`);
      reply += '\nSend: order Butter Chicken 2';
      await sock.sendMessage(from, { text: reply });
    } else if (text.startsWith('order')) {
      // ... order logic same as before
      const parts = text.split(' ').slice(1);
      let qty = 1;
      if (!isNaN(parts[parts.length-1])) qty = parseInt(parts.pop());
      const itemName = parts.join(' ');
      const [menuRows] = await db.execute('SELECT * FROM menu WHERE LOWER(item) LIKE ?', [`%${itemName.toLowerCase()}%`]);
      if (menuRows.length > 0) {
        await db.execute('INSERT INTO orders (whatsapp_number, item, quantity) VALUES (?, ?, ?)', [from, menuRows[0].item, qty]);
        await sock.sendMessage(from, { text: `✅ Order Placed!\n${qty} × ${menuRows[0].item}\nStatus: Pending` });
      } else {
        await sock.sendMessage(from, { text: '❌ Item not found. Send *menu*' });
      }
    } else {
      await sock.sendMessage(from, { text: '👋 Welcome to Dhaba!\nSend *menu* or *order item quantity*' });
    }
    await db.end();
  });
}

async function main() {
  try {
    const db = await connectDB();
    await initDB(db);
    await db.end();
    console.log('🚀 Starting WhatsApp Bot...');
    startBot();
  } catch (err) {
    console.error('❌ Failed to start bot:', err.message);
    console.error('💡 Check your DATABASE_URL in GitHub Secrets and Render Environment Variables.');
    process.exit(1);   // Stop the process clearly
  }
}

main();

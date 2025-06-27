// index.js
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidNewsletter,
  delay
} from '@whiskeysockets/baileys';
import P from 'pino';
import NodeCache from '@cacheable/node-cache';
import readline from 'readline';

import session from './sessionManager.js';
import roles from './roleManager.js';
import { parseCommand } from './utils.js';

import qrcode from 'qrcode-terminal';
import open from 'open';

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'));
const msgRetryCounterCache = new NodeCache();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    msgRetryCounterCache
  });



  sock.ev.on('creds.update', saveCreds);

  let phoneNumber;
  sock.ev.on('connection.update', async (update) => {
   const { connection, qr } = update;

    if (connection === 'connecting' && !phoneNumber && !sock.authState.creds.registered) {
        phoneNumber = await question('📞 Enter your phone number with country code (e.g., 919999999999): ');
    }

    if (connection === 'open' && phoneNumber && !sock.authState.creds.registered) {
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`🔢 Your WhatsApp pairing code is: ${code}`);
    }

    if (connection === 'open') {
        console.log('✅ Connected to WhatsApp!');
    }

    if (connection === 'close') {
        console.error('❌ Connection closed:', update);
        if (update.lastDisconnect?.error) {
        const error = update.lastDisconnect.error;
        console.error('🔍 Disconnect error details:', error);
        }
    }
});

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (!text.toLowerCase().startsWith('bb')) return;

    const { cmd, args } = parseCommand(text);
    const reply = async (m) => sock.sendMessage(from, { text: m });

    switch (cmd) {
      case 'game': {
        if (!roles.isAdmin(sender, from)) return reply('❌ Only admins can create games.');
        const createdAt = session.createGame(from, sender, args.join(' '));
        return reply(`✅ Game created for ${createdAt}. Players can now join using *bb in*.`);
      }
      case 'list':
        return reply(session.getList(from));

      case 'in':
        return reply(session.addPlayer(from, sender));

      case 'out':
        return reply(session.removePlayer(from, sender));

      case 'cancel': {
        if (!roles.isAdmin(sender, from)) return reply('❌ Only admins can cancel the game.');
        session.cancelGame(from);
        return reply('🚫 Game cancelled.');
      }

      case 'admin': {
        if (!roles.isSuperAdmin(sender) && !roles.isAdmin(sender, from)) return reply('❌ Permission denied.');
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentioned) return reply('⚠️ Please mention a user to promote.');
        roles.addAdmin(from, mentioned);
        return reply(`👑 ${mentioned} is now an admin.`);
      }

      default:
        return;
    }
  });
}

startSock();

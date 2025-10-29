const express = require('express');
const fs = require('fs');
const pino = require('pino');
const { Storage } = require('megajs');
const { nappierid } = require('./id');
const {
  default: Michal_Tech,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');

const router = express.Router();

/*━━━━━━━━━━━━━━━[ UTILITIES ]━━━━━━━━━━━━━━━*/

// 🔹 Generate random MEGA file name
function randomMegaId(length = 6, numberLength = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const id = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const num = Math.floor(Math.random() * Math.pow(10, numberLength));
  return `${id}${num}`;
}

// 🔹 Delete temp folder safely
function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
}

// 🔹 Upload creds.json to MEGA
async function uploadCredsToMega(credsPath) {
  try {
    const storage = await new Storage({
      email: 'giddynokia@gmail.com', // ⚠️ Replace if needed
      password: 'giddynokia123#',   // ⚠️ Replace if needed
    }).ready;

    console.log('✅ MEGA storage initialized.');

    if (!fs.existsSync(credsPath)) throw new Error(`File not found: ${credsPath}`);

    const fileSize = fs.statSync(credsPath).size;
    const upload = await storage.upload(
      { name: `${randomMegaId()}.json`, size: fileSize },
      fs.createReadStream(credsPath)
    ).complete;

    const fileNode = storage.files[upload.nodeId];
    const megaUrl = await fileNode.link();
    console.log(`📁 Uploaded session to MEGA: ${megaUrl}`);

    return megaUrl;
  } catch (error) {
    console.error('❌ Error uploading to MEGA:', error);
    throw error;
  }
}

/*━━━━━━━━━━━━━━━[ MAIN ROUTE ]━━━━━━━━━━━━━━━*/

router.get('/', async (req, res) => {
  const id = nappierid();
  let num = req.query.number;

  if (!num) {
    return res.status(400).send({ error: 'Missing phone number query parameter.' });
  }

  async function NAPPIER_PAIR_CODE() {
    const tempDir = `./temp/${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);

    try {
      const Michal = Michal_Tech({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Safari'),
      });

      // 🔹 Generate pairing code
      if (!Michal.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await Michal.requestPairingCode(num);
        console.log(`🔐 Pairing code for ${num}: ${code}`);

        if (!res.headersSent) {
          res.send({ code });
        }
      }

      Michal.ev.on('creds.update', saveCreds);

      Michal.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          await delay(4000);
          const filePath = `${tempDir}/creds.json`;

          if (!fs.existsSync(filePath)) return console.error('❌ creds.json not found.');

          const megaUrl = await uploadCredsToMega(filePath);
          const sid = megaUrl.includes('https://mega.nz/file/')
            ? 'nappier~' + megaUrl.split('https://mega.nz/file/')[1]
            : 'Error: Invalid MEGA URL';

          console.log(`✅ SESSION ID: ${sid}`);

          const session = await Michal.sendMessage(Michal.user.id, { text: sid });

          const INFO_MSG = `
╔════════════════════◇
║『 SESSION CONNECTED 』
║ ✨ NAPPIER-XMD 🔷
║ ✨ Powered by Michal-Tech 🔷
╚════════════════════╝

╔════════════════════◇
║『 YOUR SESSION ID 』
║ Paste this on Heroku/Vercel as:
║ SESSION_ID=${sid}
╚════════════════════╝

╔════════════════════◇
║『 CONNECT WITH OWNER 』
║ ❍ YouTube: youtube.com/@davlodavlo19
║ ❍ GitHub: https://github.com/hacker-nap
║ ❍ Channel: https://whatsapp.com/channel/0029VbBRLb04dTnRzJI0781D
║ ❍ WhatsApp: wa.me/254104260236
╚═════════════════════╝

⭐ Enjoy NAPPIER-XMD — smooth, fast, and powerful!
`;

          await Michal.sendMessage(Michal.user.id, { text: INFO_MSG }, { quoted: session });

          await delay(500);
          await Michal.ws.close();
          removeFile(tempDir);
        } else if (
          connection === 'close' &&
          lastDisconnect &&
          lastDisconnect.error?.output?.statusCode !== 401
        ) {
          console.log('🔄 Connection closed, retrying...');
          await delay(5000);
          NAPPIER_PAIR_CODE();
        }
      });
    } catch (err) {
      console.error('⚠️ Service Restarted:', err);
      removeFile(tempDir);
      if (!res.headersSent) res.send({ code: 'Service currently unavailable' });
    }
  }

  await NAPPIER_PAIR_CODE();
});

module.exports = router;
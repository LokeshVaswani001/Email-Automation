import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS;

// ── Email log file path ──
const LOG_FILE = path.join(__dirname, 'email-log.json');

// ── Scheduled emails store (in-memory) ──
let scheduledJobs = {};

// ══════════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════════
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve HTML/CSS/JS

// ✅ Homepage Route Fix
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ══════════════════════════════════════════════════════
//  NODEMAILER TRANSPORTER (Gmail SMTP)
// ══════════════════════════════════════════════════════
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS,
  },
});

// ══════════════════════════════════════════════════════
//  HELPER: Read email log
// ══════════════════════════════════════════════════════
function readLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════
//  HELPER: Write email log
// ══════════════════════════════════════════════════════
function writeLog(entry) {
  const logs = readLog();
  logs.unshift(entry);

  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// ══════════════════════════════════════════════════════
//  SEND EMAIL FUNCTION
// ══════════════════════════════════════════════════════
async function sendEmail({ to, subject, body, type = 'manual' }) {

  const timestamp = new Date().toISOString();

  const mailOptions = {
    from: `"AI Email Bot" <${GMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:10px;">
        
        <div style="background:#7c5cfc;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="color:white;margin:0;">
            📧 ${subject}
          </h2>
        </div>

        <div style="background:white;padding:24px;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:none;">
          
          <p style="color:#333;font-size:15px;line-height:1.7;">
            ${body.replace(/\n/g, '<br/>')}
          </p>

          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />

          <p style="color:#999;font-size:12px;">
            Sent via Email Automation Script · ${new Date().toLocaleString()}
          </p>

        </div>
      </div>
    `,
  };

  try {

    const info = await transporter.sendMail(mailOptions);

    writeLog({
      id: Date.now(),
      type,
      to,
      subject,
      body,
      status: 'sent',
      messageId: info.messageId,
      timestamp,
    });

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {

    writeLog({
      id: Date.now(),
      type,
      to,
      subject,
      body,
      status: 'failed',
      error: error.message,
      timestamp,
    });

    throw error;
  }
}

// ══════════════════════════════════════════════════════
//  SEND EMAIL API
// ══════════════════════════════════════════════════════
app.post('/api/send', async (req, res) => {

  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({
      error: 'to, subject, and body are required.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(to)) {
    return res.status(400).json({
      error: 'Invalid email address format.'
    });
  }

  try {

    const result = await sendEmail({
      to,
      subject,
      body,
      type: 'immediate'
    });

    res.json({
      success: true,
      message: 'Email sent successfully!',
      messageId: result.messageId
    });

  } catch (error) {

    res.status(500).json({
      error: 'Failed to send email: ' + error.message
    });

  }
});

// ══════════════════════════════════════════════════════
//  GET EMAIL LOGS
// ══════════════════════════════════════════════════════
app.get('/api/logs', (req, res) => {
  res.json(readLog());
});

// ══════════════════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════════════════
app.listen(PORT, () => {

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Email Automation Running ✅       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  console.log(`🌐 Server: http://localhost:${PORT}`);

  if (!GMAIL_USER || !GMAIL_APP_PASS) {

    console.log('');
    console.log('⚠ Gmail credentials missing!');
    console.log('');

  } else {

    console.log('');
    console.log(`📧 Gmail Connected: ${GMAIL_USER}`);
    console.log('');

  }

});
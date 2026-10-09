const crypto = require('crypto');
const path = require('path');
const ejs = require('ejs');
const nodemailer = require('nodemailer');
const config = require('../config');

const TEMPLATE = path.join(__dirname, '..', 'views', 'emails', 'message.ejs');
const OUTBOX_LIMIT = 50;

const transporter = config.mail.smtp ? nodemailer.createTransport(config.mail.smtp) : null;

// Development / test only. Lets the whole sign-up flow work on a laptop with
// no SMTP account, and gives the tests a way to read the links we send.
const outbox = [];

function toText({ heading, paragraphs, action, footnote }) {
  const lines = [heading, '', ...paragraphs];
  if (action) lines.push('', `${action.label}: ${action.url}`);
  if (footnote) lines.push('', footnote);
  return lines.join('\n');
}

async function sendMail({ to, subject, content }) {
  const html = await ejs.renderFile(TEMPLATE, { appName: config.appName, subject, ...content });
  const text = toText(content);

  if (transporter) {
    await transporter.sendMail({ from: config.mail.from, to, subject, html, text });
  }

  if (config.mail.devMailbox) {
    outbox.unshift({
      id: crypto.randomBytes(6).toString('hex'),
      to,
      subject,
      html,
      text,
      action: content.action || null,
      sentAt: new Date()
    });
    outbox.length = Math.min(outbox.length, OUTBOX_LIMIT);

    if (!config.isTest) {
      const link = content.action ? ` -> ${content.action.url}` : '';
      console.log(`[mail] "${subject}" to ${to}${link}`);
    }
  }
}

function getOutbox() {
  return outbox;
}

function findMessage(id) {
  return outbox.find((message) => message.id === id);
}

function clearOutbox() {
  outbox.length = 0;
}

module.exports = { sendMail, getOutbox, findMessage, clearOutbox };

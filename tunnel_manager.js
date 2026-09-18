const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');

function generateQrCode(tunnelUrl) {
  const agent = new https.Agent({ rejectUnauthorized: false });
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=' + encodeURIComponent(tunnelUrl);
  https.get(qrUrl, { agent }, (res) => {
    const f1 = fs.createWriteStream('public/qrcode_mobile.png');
    const f2 = fs.createWriteStream('C:/Users/luciano/.gemini/antigravity/brain/974e3f9a-2dec-42eb-80cc-356ce0b6b9d2/qrcode_mobile.png');
    res.pipe(f1);
    res.pipe(f2);
  }).on('error', () => {});
}

function updateHtmlFiles(tunnelUrl) {
  ['public/app.html', 'public/admin.html', 'public/index.html'].forEach(filePath => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/const PUBLIC_MOBILE_URL = 'https:\/\/[^']+';/, `const PUBLIC_MOBILE_URL = '${tunnelUrl}';`);
      fs.writeFileSync(filePath, content, 'utf8');
    } catch(e) {}
  });
}

function startTunnel() {
  console.log('[Tunnel Manager] Iniciando túnel Cloudflare sem prechecks...');
  const child = spawn('.\\cloudflared.exe', [
    'tunnel',
    '--no-prechecks',
    '--url', 'http://localhost:3000'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let urlFound = false;

  function handleData(chunk) {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !urlFound) {
      urlFound = true;
      const url = match[0] + '/';
      console.log('[Tunnel Manager] URL PÚBLICA DISPONÍVEL:', url);
      fs.writeFileSync('public_tunnel_url.txt', url, 'utf8');
      updateHtmlFiles(url);
      generateQrCode(url);
    }
  }

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);

  child.on('exit', (code) => {
    console.log(`[Tunnel Manager] Túnel encerrou (código ${code}). Reiniciando em 3s...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();

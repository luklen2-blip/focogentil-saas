/**
 * Servidor Nativo Autônomo - FocoGentil SaaS V2
 * Executa em qualquer ambiente Node.js v18+ sem necessidade de npm install!
 * Inclui:
 * - Landing Page Comercial V2 e Dashboard Minimalista (/app)
 * - Painel Administrativo (/admin)
 * - Autenticação Real com PBKDF2 e Sessões Seguras
 * - Camada de IA Desacoplada (Brain Dump, Estou Travado, Plano Diário, Chat)
 * - Webhook Twilio WhatsApp e Simulador (/simulador)
 * - Webhook de Pagamento Único e PIX Oficial (Banco Central)
 * - Despachante interno de lembretes suaves
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const db = require('./database');
const aiService = require('./ai_service');
const audioTranscriber = require('./audio_transcriber');
const pixService = require('./pix_service');

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const CHECKOUT_URL = process.env.CHECKOUT_URL || `http://localhost:${PORT}/checkout.html`;

// -------------------------------------------------------------
// Motor de Decomposição Neurodivergente (Compatibilidade WhatsApp)
// -------------------------------------------------------------
function decomposeTask(projectText, energyLevel = 'media') {
  const cleanTitle = projectText.trim().slice(0, 45);
  
  let ignitionMinutes = 3;
  let ignitionAction = `Apenas abrir o material/local de '${cleanTitle}' e respirar fundo`;
  
  if (energyLevel === 'baixa') {
    ignitionMinutes = 2;
    ignitionAction = `Pegar um copo d'água e apenas sentar na mesa de trabalho`;
  } else if (energyLevel === 'alta') {
    ignitionMinutes = 5;
    ignitionAction = `Abrir o arquivo principal e listar os primeiros 3 tópicos`;
  }

  return {
    project_title: cleanTitle,
    energy_level: energyLevel,
    recommended_first_step: ignitionAction,
    micro_tasks: [
      {
        step_number: 1,
        title: ignitionAction,
        duration_minutes: ignitionMinutes,
        why_it_helps: "Passo de ignição imediata com fricção quase zero para desbloquear a dopamina",
        urgency_score: 5
      },
      {
        step_number: 2,
        title: "Escrever 2 ou 3 tópicos essenciais sem se preocupar com perfeição",
        duration_minutes: 8,
        why_it_helps: "Foco atômico para dar tração inicial",
        urgency_score: 4
      },
      {
        step_number: 3,
        title: "Executar o ponto central por 10 minutos com alarme suave",
        duration_minutes: 10,
        why_it_helps: "Contorno da cegueira temporal com bloco curto de tempo",
        urgency_score: 3
      },
      {
        step_number: 4,
        title: "Pausa restaurativa de 5 min para alongar e beber água",
        duration_minutes: 5,
        why_it_helps: "Prevenção de esgotamento e recarga cognitiva",
        urgency_score: 2
      }
    ],
    gentle_tip: "Você não precisa terminar tudo hoje. Faça só o Passo 1 e já considere uma vitória!"
  };
}

function formatWhatsAppText(breakdown) {
  const lines = [
    `🌱 *Projeto:* ${breakdown.project_title}`,
    `🔋 *Nível de Energia:* ${breakdown.energy_level.toUpperCase()}`,
    "",
    "Quebrei em passos supercurtos para o seu cérebro não travar:",
    ""
  ];

  breakdown.micro_tasks.forEach(t => {
    const icon = t.step_number === 1 ? "⚡" : "🔹";
    lines.push(`${icon} *Passo ${t.step_number}* (⏱️ ${t.duration_minutes} min)`);
    lines.push(`   _${t.title}_`);
    lines.push("");
  });

  lines.push(`💡 *Dica:* ${breakdown.gentle_tip}`);
  lines.push("");
  lines.push("👇 *O que fazer agora?* Responda apenas:");
  lines.push("*1* - Concluí o Passo 1! 🎉");
  lines.push("*2* - Travei: dividir em etapas menores 🤏");
  lines.push("*3* - Pausa de 30 minutos sem culpa ⏸️");

  return lines.join('\n');
}

function buildTwiml(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

// -------------------------------------------------------------
// Servidor HTTP Principal
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    console.log(`[HTTP] ${req.method} ${pathname}`);

  // Habilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Coleta corpo da requisição POST/PUT
  let body = '';
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    for await (const chunk of req) {
      body += chunk;
    }
  }

  function getPayload() {
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch {
      return querystring.parse(body);
    }
  }

  function getAuthUser() {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      return db.getSessionUser(token);
    }
    return null;
  }

  // =============================================================
  // 0. HEALTH CHECK PARA PROVEDORES DE NUVEM (RENDER / DOCKER / UPTIME)
  // =============================================================
  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      app: 'FocoGentil Copilot SaaS',
      version: '2.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // =============================================================
  // 1. ROTAS DE AUTENTICAÇÃO REAL V2
  // =============================================================
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const payload = getPayload();
    if (!payload.email || !payload.password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "E-mail e senha são obrigatórios." }));
      return;
    }
    try {
      const user = db.createUser(payload);
      const token = db.createSession(user.id);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token, user }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const payload = getPayload();
    const user = db.verifyUserPassword(payload.email, payload.password);
    if (user) {
      const token = db.createSession(user.id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token, user }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "E-mail ou senha incorretos." }));
    }
    return;
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = getAuthUser();
    if (user) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(user));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Não autorizado." }));
    }
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      db.deleteSession(authHeader.substring(7).trim());
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // =============================================================
  // 2. ROTAS DE TAREFAS V2 (PROGRESSÃO AGORA / PRÓXIMO / DEPOIS)
  // =============================================================
  if (pathname === '/api/tasks' && req.method === 'GET') {
    const user = getAuthUser();
    const userId = user ? user.id : 'demo_user';
    const status = parsedUrl.query.status || null;
    const tasks = db.getUserTasks(userId, status);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tasks));
    return;
  }

  if (pathname === '/api/tasks' && req.method === 'POST') {
    const user = getAuthUser();
    const userId = user ? user.id : 'demo_user';
    const payload = getPayload();
    const task = db.createTask(userId, payload);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(task));
    return;
  }

  // Completa tarefa e promove a próxima
  const completeMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/complete$/);
  if (completeMatch && req.method === 'POST') {
    const taskId = completeMatch[1];
    const user = getAuthUser();
    const userId = user ? user.id : 'demo_user';
    const result = db.completeTask(userId, taskId);
    if (result) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Tarefa não encontrada." }));
    }
    return;
  }

  // Atualiza ou Deleta tarefa
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PUT') {
    const taskId = taskMatch[1];
    const user = getAuthUser();
    const userId = user ? user.id : 'demo_user';
    const payload = getPayload();
    const updated = db.updateTask(userId, taskId, payload);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(updated));
    return;
  }

  if (taskMatch && req.method === 'DELETE') {
    const taskId = taskMatch[1];
    const user = getAuthUser();
    const userId = user ? user.id : 'demo_user';
    const ok = db.deleteTask(userId, taskId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: ok }));
    return;
  }

  // =============================================================
  // 3. ROTAS DE IA DESACOPLADA V2
  // =============================================================
  if (pathname === '/api/ai/brain-dump' && req.method === 'POST') {
    const payload = getPayload();
    const result = await aiService.parseBrainDump(payload.text || '', payload.energy || 'media');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/api/ai/unblock' && req.method === 'POST') {
    const payload = getPayload();
    const result = await aiService.unblockTask(payload.task || '', payload.reason || '', payload.stage || 1);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/api/ai/break-task' && req.method === 'POST') {
    const payload = getPayload();
    const result = await aiService.breakTask(payload.task || '', payload.energy || 'media');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/api/ai/daily-plan' && req.method === 'POST') {
    const payload = getPayload();
    const user = getAuthUser();
    const userId = user ? user.id : 'demo_user';
    const userTasks = payload.tasks || db.getUserTasks(userId);
    const result = await aiService.generateDailyPlan(userTasks, payload.energy || 'media', payload.available_hours || 6);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    const payload = getPayload();
    const reply = await aiService.chatCopilot(payload.message || '', payload.history || [], payload.energy || 'media');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ response: reply }));
    return;
  }

  // =============================================================
  // 4. CONFIGURAÇÃO DE USUÁRIO & ENERGIA
  // =============================================================
  if (pathname === '/api/user/energy' && req.method === 'POST') {
    const payload = getPayload();
    const user = getAuthUser();
    if (user) {
      db.updateUserProfile(user.id, { energy_level: payload.energy });
      db.logUserEnergy(user.id, payload.energy);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, energy: payload.energy }));
    return;
  }

  // =============================================================
  // 5. PAINEL ADMINISTRATIVO V2
  // =============================================================
  if (pathname === '/api/admin/metrics' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db.getAllStats()));
    return;
  }

  if (pathname === '/api/admin/users' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db.getAllUsersList()));
    return;
  }

  if (pathname === '/api/admin/payments' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db.getAllPaymentsList()));
    return;
  }

  if ((pathname === '/api/admin/payments/update-status' || pathname.startsWith('/api/admin/payments/')) && req.method === 'POST') {
    const payload = getPayload();
    let paymentId = payload.payment_id;
    if (!paymentId && pathname.includes('/status')) {
      const parts = pathname.split('/');
      paymentId = parts[parts.length - 2];
    }
    const newStatus = payload.status || 'approved';
    try {
      const result = db.updatePaymentStatus(paymentId, newStatus);
      if (!result) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Pagamento não encontrado." }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // =============================================================
  // 6. ROTAS DO TWILIO & WHATSAPP (PRESERVADAS 100%)
  // =============================================================
  if (pathname === '/api/webhook/twilio' && req.method === 'POST') {
    const payload = getPayload();
    const fromPhone = payload.From || payload.from || '+5511999999999';
    let userMessage = (payload.Body || payload.body || '').trim();
    const mediaUrl = payload.MediaUrl0 || payload.media_url;

    if (mediaUrl) {
      const transcribed = await audioTranscriber.transcribeWhatsAppAudio(mediaUrl);
      if (transcribed) userMessage = transcribed;
    }

    const cleanPhone = db.normalizePhone(fromPhone);
    const user = db.registerOrGetUser(cleanPhone, payload.ProfileName);

    if (!db.isAuthorized(cleanPhone)) {
      const checkoutUrlWithPhone = `${CHECKOUT_URL}?phone=${encodeURIComponent(cleanPhone)}`;
      const checkoutMsg = (
        "🔒 *Seus 30 minutos de teste gratuito se esgotaram!*\n\n" +
        "Para continuar usando o *FocoGentil* e ter seu *Acesso Vitalício* (sem nenhuma mensalidade),\n" +
        "o pagamento é feito exclusivamente por *PIX* ou *Cartão de Crédito*:\n\n" +
        "⚡ *PIX Instantâneo* (Ativação imediata via QR Code)\n" +
        "💳 *Cartão de Crédito* (1x sem mensalidade)\n\n" +
        `👉 Escolha entre PIX ou Cartão e libere seu acesso agora:\n${checkoutUrlWithPhone}\n\n` +
        "_Assim que o pagamento for confirmado, seu WhatsApp volta a funcionar para sempre!_"
      );
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(buildTwiml(checkoutMsg));
      return;
    }

    if (userMessage === '1') {
      const victoryMsg = (
        "🌟 *Sensacional! Parabéns pelo micropasso concluído!*\n" +
        "A dopamina veio. Quer fazer a próxima etapa agora ou prefere uma pausa?\n\n" +
        "Envie o próximo projeto ou digite *PAUSA* para respirar."
      );
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(buildTwiml(victoryMsg));
      return;
    }

    if (userMessage === '2') {
      const shrinkMsg = (
        "🤏 *Sem crise!* Vamos dividir em etapas ainda menores.\n" +
        "Seu único objetivo nos próximos 2 minutos é:\n" +
        "👉 *Apenas encostar a mão no material ou abrir a aba do navegador.*\n\n" +
        "Não precisa fazer mais nada além disso. Me mande um *OK* quando fizer."
      );
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(buildTwiml(shrinkMsg));
      return;
    }

    if (userMessage === '3') {
      db.scheduleReminder(cleanPhone, "Retomar tarefa após pausa gentil", 5, 30);
      const snoozeMsg = (
        "⏸️ *Pausa de 30 minutos ativada sem culpa!*\n" +
        "O descanso faz parte da produtividade. Te mando um alô suave daqui a 30 minutos. Beba uma água! 💧"
      );
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(buildTwiml(snoozeMsg));
      return;
    }

    const breakdown = decomposeTask(userMessage, user.energy_level);
    db.saveProject(cleanPhone, breakdown);
    db.scheduleReminder(cleanPhone, breakdown.micro_tasks[0].title, breakdown.micro_tasks[0].duration_minutes);

    const waText = formatWhatsAppText(breakdown);
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(buildTwiml(waText));
    return;
  }

  // =============================================================
  // 7. WEBHOOK DE PAGAMENTO & COBRANÇA PIX (PRESERVADOS 100%)
  // =============================================================
  if (pathname === '/api/webhook/payment' && req.method === 'POST') {
    const payload = getPayload();
    const phone = payload.phone_number || payload.customer_phone;
    const paymentId = payload.payment_id || 'PAY_' + Date.now();
    const amount = payload.amount || 97.00;
    const provider = payload.provider || 'mercadopago';
    const customerName = payload.customer_name || 'Cliente';
    const isRecurring = Boolean(payload.is_recurring);

    if (isRecurring) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Apenas pagamentos únicos são suportados." }));
      return;
    }

    if (!phone) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Número de telefone obrigatório." }));
      return;
    }

    const activatedUser = db.activateLifetimeLicense(phone, paymentId, amount, provider, customerName);
    console.log(`[Pagamento Único] Usuário ativado com sucesso: ${activatedUser.phone_number} (Sem mensalidade)`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: "Acesso vitalício ativado com sucesso!",
      user: activatedUser
    }));
    return;
  }

  if (pathname === '/api/settings' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db.getBillingSettings()));
    return;
  }

  if (pathname === '/api/settings' && req.method === 'POST') {
    const payload = getPayload();
    const updated = db.updateBillingSettings(payload);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, settings: updated }));
    return;
  }

  if (pathname === '/api/payments/status' && req.method === 'GET') {
    const paymentId = parsedUrl.query.id || parsedUrl.query.payment_id;
    if (!paymentId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "ID do pagamento obrigatório." }));
      return;
    }
    const payment = db.getPaymentById(paymentId);
    if (!payment) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Pagamento não encontrado." }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      payment_id: payment.payment_id,
      status: payment.status,
      approved: payment.status === 'approved',
      amount: payment.amount,
      plan: payment.plan
    }));
    return;
  }

  if (pathname === '/api/pix/create' && req.method === 'POST') {
    const payload = getPayload();
    const settings = db.getBillingSettings();
    const amount = payload.amount !== undefined && Number(payload.amount) > 0 
      ? Number(payload.amount) 
      : Number(settings.price);
    const phone = payload.phone || payload.phone_number || '+5511999998888';
    const customerName = payload.name || payload.customer_name || 'Cliente';
    const plan = payload.plan || (amount <= 30 ? 'pro' : 'vitalicio');
    const paymentId = 'PIX_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Registra como pending no banco
    db.createPendingPayment({
      payment_id: paymentId,
      user_id: payload.user_id || null,
      phone: phone,
      email: payload.email || null,
      amount: amount,
      plan: plan,
      provider: 'pix',
      customer_name: customerName
    });

    const pixCode = pixService.generateBrCode({
      pixKey: settings.pix_key,
      amount: amount,
      merchantName: settings.pix_name || 'FOCOGENTIL',
      merchantCity: settings.pix_city || 'SAO PAULO',
      txid: paymentId.slice(-15).replace(/[^a-zA-Z0-9]/g, '')
    });

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      payment_id: paymentId,
      status: 'pending',
      amount: amount,
      plan: plan,
      pix_key: settings.pix_key,
      merchant_name: settings.pix_name,
      pix_code: pixCode,
      qr_code_url: qrCodeUrl,
      phone: phone,
      name: customerName
    }));
    return;
  }

  if (pathname === '/api/pix/confirm' && req.method === 'POST') {
    const payload = getPayload();
    const paymentId = payload.payment_id || payload.id;
    const phone = payload.phone || payload.phone_number;
    const name = payload.name || payload.customer_name;
    const amount = payload.amount || 97.00;
    const plan = payload.plan || (Number(amount) <= 30 ? 'pro' : 'vitalicio');

    // Se payment_id existir, consulta o status real
    if (paymentId) {
      const payment = db.getPaymentById(paymentId);
      if (payment) {
        if (payment.status === 'approved') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            status: 'approved',
            plan: payment.plan,
            message: "Pagamento aprovado com sucesso!"
          }));
          return;
        } else if (!payload.admin_override) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            status: payment.status || 'pending',
            message: "Aguardando confirmação do banco emissor. O acesso será liberado assim que o PIX for compensado."
          }));
          return;
        }
      }
    }

    // Se for admin_override ou chamada autenticada interna
    if (payload.admin_override) {
      const pId = paymentId || ('PIX_PAGO_' + Date.now());
      let activatedUser;
      if (plan === 'pro') {
        activatedUser = db.activateProSubscription(phone || 'cliente@focogentil.com', pId, amount, 'pix_admin', name);
      } else {
        activatedUser = db.activateLifetimeLicense(phone || '+5511999998888', pId, amount, 'pix_admin', name);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'approved',
        plan: plan,
        message: "Pagamento aprovado via credenciamento administrativo.",
        user: activatedUser
      }));
      return;
    }

    // Se não informou payment_id (teste direto de confirmação ou checkout direto)
    if (!paymentId) {
      const pId = 'PIX_CONF_' + Date.now();
      let activatedUser;
      if (plan === 'pro') {
        activatedUser = db.activateProSubscription(phone || 'cliente@focogentil.com', pId, amount, 'pix', name);
      } else {
        activatedUser = db.activateLifetimeLicense(phone || '+5511999998888', pId, amount, 'pix', name);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'approved',
        plan: plan,
        message: "Pagamento confirmado com sucesso!",
        user: activatedUser
      }));
      return;
    }

    // Usuário comum tentando confirmar payment_id pendente sem aprovação bancária real
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      status: 'pending',
      message: "Pagamento ainda não confirmado pela instituição financeira. Aguardando compensação."
    }));
    return;
  }

  // Rota dedicada para Assinatura do Plano Pro Mensal (Cartão Recorrente ou PIX Mensal)
  if (pathname === '/api/subscription/subscribe' && req.method === 'POST') {
    const payload = getPayload();
    const phone = payload.phone || payload.phone_number;
    const email = payload.email;
    const customerName = payload.name || payload.customer_name || 'Cliente Pro';
    const plan = payload.plan || 'pro';
    const paymentMethod = payload.payment_method || 'card';
    const amount = payload.amount || (plan === 'vitalicio' ? Number(db.getBillingSettings().price) : 29.00);

    if (!phone && !email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Informe seu WhatsApp ou e-mail para ativar a assinatura." }));
      return;
    }

    const identifier = phone || email;
    const paymentId = (paymentMethod === 'pix' ? 'PIX_SUB_' : 'CARD_SUB_') + Date.now();
    let activatedUser;

    if (plan === 'vitalicio') {
      activatedUser = db.activateLifetimeLicense(identifier, paymentId, amount, paymentMethod, customerName);
    } else {
      activatedUser = db.activateProSubscription(identifier, paymentId, amount, paymentMethod, customerName);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      plan: plan,
      amount: amount,
      message: plan === 'vitalicio' ? "Acesso Vitalício ativado com sucesso!" : "Assinatura Plano Pro ativada com sucesso!",
      user: activatedUser
    }));
    return;
  }

  // Rotas de Checkout Adicionais (V2 / Master Spec)
  if (pathname === '/api/checkout/create-charge' && req.method === 'POST') {
    const payload = getPayload();
    const settings = db.getBillingSettings();
    const plan = payload.plan || 'vitalicio';
    const amount = payload.amount || (plan === 'mensal' || plan === 'pro' ? 29.00 : 97.00);
    const paymentId = 'CHG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const pixCode = pixService.generateBrCode({
      pixKey: settings.pix_key,
      amount: amount,
      merchantName: settings.pix_name || 'FOCOGENTIL',
      merchantCity: settings.pix_city || 'SAO PAULO',
      txid: paymentId.slice(-15).replace(/[^a-zA-Z0-9]/g, '')
    });

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      charge_id: paymentId,
      plan: plan,
      amount: amount,
      pix_code: pixCode,
      qr_code_url: qrCodeUrl
    }));
    return;
  }

  if (pathname === '/api/checkout/status' && req.method === 'GET') {
    const user = getAuthUser();
    const rawPlan = user ? (user.plan || 'gratuito') : 'gratuito';
    const plan = (rawPlan === 'gratuito' || rawPlan === 'free') ? 'free' : rawPlan;
    const hasPro = plan === 'pro' || plan === 'vitalicio';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      plan: plan,
      raw_plan: rawPlan,
      has_pro_access: hasPro,
      is_trial_active: true,
      trial_minutes_remaining: 30
    }));
    return;
  }

  if (pathname === '/api/checkout/simulate-approval' && req.method === 'POST') {
    const payload = getPayload();
    const email = payload.email;
    const plan = (payload.plan === 'mensal' || payload.plan === 'pro') ? 'pro' : 'vitalicio';
    if (email) {
      const u = db.findUserByEmail(email);
      if (u) {
        db.updateUserProfile(u.id, { 
          plan: plan,
          is_lifetime_active: plan === 'vitalicio',
          has_recurring_subscription: plan === 'pro'
        });
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      plan: plan,
      message: `Plano ${plan} aprovado com sucesso.`
    }));
    return;
  }

  // =============================================================
  // 8. SIMULADOR DO WHATSAPP (PRESERVADO)
  // =============================================================
  if (pathname === '/api/simulate' && req.method === 'POST') {
    const payload = getPayload();
    const phone = payload.phone || '+5511999998888';
    const message = (payload.message || '').trim();
    const energy = payload.energy || 'media';
    const isAudio = Boolean(payload.is_audio);

    const cleanPhone = db.normalizePhone(phone);
    const user = db.registerOrGetUser(cleanPhone);
    db.setUserEnergy(cleanPhone, energy);
    const trialStatus = db.getTrialStatus(cleanPhone);

    if (!db.isAuthorized(cleanPhone)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        is_authorized: false,
        trial_status: trialStatus,
        response_text: (
          "🔒 *ACESSO PAUSADO: Seus 30 minutos de teste gratuito terminaram!*\n\n" +
          "A partir de agora, o acesso vitalício é liberado exclusivamente via *PIX* ou *Cartão de Crédito (1x)*:\n\n" +
          "⚡ *PIX Instantâneo* (Ativação imediata)\n" +
          "💳 *Cartão de Crédito* (1x sem mensalidades futuras)\n\n" +
          "👉 Clique no botão abaixo para escolher entre PIX ou Cartão e ter Acesso Vitalício!"
        )
      }));
      return;
    }

    if (message === '1') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        is_authorized: true,
        trial_status: trialStatus,
        response_text: "🌟 *Sensacional! Parabéns pelo micropasso concluído!*\nA dopamina veio! Vamos para a próxima pequena vitória? 🎉"
      }));
      return;
    }

    if (message === '2') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        is_authorized: true,
        trial_status: trialStatus,
        response_text: "🤏 *Sem crise!* Vamos dividir em etapas ainda menores:\n👉 *Apenas abra a pasta ou pegue o material na mão e respire.*\nQuando fizer, clique no 1!"
      }));
      return;
    }

    if (message === '3') {
      db.scheduleReminder(cleanPhone, "Retomar após pausa gentil", 5, 30);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        is_authorized: true,
        trial_status: trialStatus,
        response_text: "⏸️ *Pausa de 30 minutos ativada sem culpa!*\nO descanso recarrega seu cérebro. Te mando um alô depois! 💧"
      }));
      return;
    }

    let processedMessage = message;
    if (isAudio) {
      processedMessage = "Preciso lavar a louça acumulada na pia e separar as roupas para lavar, mas estou travado.";
    }

    const breakdown = decomposeTask(processedMessage, energy);
    db.saveProject(cleanPhone, breakdown);
    db.scheduleReminder(cleanPhone, breakdown.micro_tasks[0].title, breakdown.micro_tasks[0].duration_minutes);

    const waText = formatWhatsAppText(breakdown);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      is_authorized: true,
      trial_status: trialStatus,
      breakdown: breakdown,
      response_text: waText
    }));
    return;
  }

  if (pathname === '/api/trial-status' && req.method === 'GET') {
    const queryPhone = parsedUrl.query.phone || '+5511999998888';
    db.registerOrGetUser(queryPhone);
    const status = db.getTrialStatus(queryPhone);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  if (pathname === '/api/simulate/expire-trial' && req.method === 'POST') {
    const payload = getPayload();
    const phone = payload.phone || '+5511999998888';
    db.expireTrialNow(phone);
    const status = db.getTrialStatus(phone);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: "Teste de 30 minutos expirado!", trial_status: status }));
    return;
  }

  if (pathname === '/api/simulate/reset-trial' && req.method === 'POST') {
    const payload = getPayload();
    const phone = payload.phone || '+5511999998888';
    db.resetTrial(phone);
    const status = db.getTrialStatus(phone);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: "Teste de 30 minutos reiniciado!", trial_status: status }));
    return;
  }

  if (pathname === '/api/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db.getAllStats()));
    return;
  }

  if (pathname === '/api/reminders/dispatch' && req.method === 'POST') {
    const due = db.getDueReminders();
    due.forEach(r => {
      console.log(`[Lembrete Gentil Enviado] Para: ${r.user_phone} -> ${r.task_title}`);
      db.markReminderDispatched(r.id);
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ dispatched_count: due.length, reminders: due }));
    return;
  }

  // =============================================================
  // 9. SERVIDOR DE PÁGINAS E ARQUIVOS ESTÁTICOS V2
  // =============================================================
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  let targetFile = '';
  if (pathname === '/' || pathname === '/index' || pathname === '/index.html' || pathname === '/home') {
    targetFile = 'index.html'; // Landing page comercial
  } else if (pathname === '/app' || pathname === '/app.html' || pathname === '/dashboard' || pathname === '/painel' || pathname === '/copiloto' || pathname === '/login') {
    targetFile = 'app.html';   // SaaS Dashboard V2
  } else if (pathname === '/admin' || pathname === '/admin.html' || pathname === '/gerente') {
    targetFile = 'admin.html'; // Painel de Administração
  } else if (pathname === '/simulador' || pathname === '/simulador.html' || pathname === '/whatsapp') {
    targetFile = 'simulador.html'; // Simulador WhatsApp Preservado
  } else if (pathname === '/checkout' || pathname === '/checkout.html' || pathname === '/pagamento' || pathname === '/pix') {
    targetFile = 'checkout.html'; // Checkout Preservado
  } else if (pathname === '/termos' || pathname === '/termos.html') {
    targetFile = 'termos.html'; // Termos de Uso
  } else if (pathname === '/privacidade' || pathname === '/privacidade.html' || pathname === '/lgpd') {
    targetFile = 'privacidade.html'; // Política de Privacidade
  } else {
    targetFile = pathname.replace(/^\//, '');
  }

  let filePath = path.join(__dirname, 'public', targetFile);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.xml': 'application/xml; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback para SPA: se não for rota de API e não encontrou arquivo, entrega index.html
  if (!pathname.startsWith('/api/')) {
    const fallbackPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallbackPath).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
  } catch (serverErr) {
    console.error('[Server Error Handler]', serverErr);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Erro interno no servidor." }));
    }
  }
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

// Agendador em segundo plano: verifica lembretes a cada 30 segundos
const cronTimer = setInterval(() => {
  const due = db.getDueReminders();
  if (due.length > 0) {
    due.forEach(r => {
      console.log(`[Cron Interno] Lembrete disparado para ${r.user_phone}: "${r.task_title}"`);
      db.markReminderDispatched(r.id);
    });
  }
}, 30000);
cronTimer.unref();

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🧠 FOCOGENTIL SAAS V2 INICIADO COM SUCESSO!`);
    console.log(`🌐 Landing Page Comercial: http://localhost:${PORT}/`);
    console.log(`📱 App Copiloto V2: http://localhost:${PORT}/app`);
    console.log(`⚙️ Painel Administrativo: http://localhost:${PORT}/admin`);
    console.log(`💬 Simulador WhatsApp: http://localhost:${PORT}/simulador`);
    console.log(`💳 Checkout Vitalício: http://localhost:${PORT}/checkout`);
    console.log(`====================================================`);
  });
}

module.exports = { server, decomposeTask, formatWhatsAppText, buildTwiml };

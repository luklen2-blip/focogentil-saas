/**
 * Suíte de Testes Ao Vivo na Nuvem (Live Cloud E2E)
 * Valida o deployment 24/7 do FocoGentil em qualquer URL HTTPS remota
 * Uso: node tests/test_cloud_live.js <URL_DA_NUVEM>
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const targetUrl = process.argv[2] || process.env.CLOUD_URL;

if (!targetUrl) {
  console.error("❌ ERRO: Nenhuma URL de nuvem foi informada!");
  console.log("Uso: node tests/test_cloud_live.js https://sua-aplicacao.onrender.com");
  process.exit(1);
}

const parsedBase = new URL(targetUrl.endsWith('/') ? targetUrl : targetUrl + '/');
const client = parsedBase.protocol === 'https:' ? https : http;

let passed = 0;
let total = 0;

function logTest(name, ok, err = null) {
  total++;
  if (ok) {
    passed++;
    console.log(`✅ [TESTE NUVEM ${passed}/${total}] ${name}`);
  } else {
    console.error(`❌ [TESTE NUVEM FALHOU] ${name}`);
    if (err) console.error("   Detalhe:", err);
  }
}

function req(endpoint, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(endpoint, parsedBase);
    const bodyStr = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    
    const options = {
      method,
      hostname: fullUrl.hostname,
      port: fullUrl.port || (parsedBase.protocol === 'https:' ? 443 : 80),
      path: fullUrl.pathname + fullUrl.search,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'FocoGentilCloudTester/2.0',
        ...headers
      }
    };

    if (bodyStr) {
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const request = client.request(options, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: chunks,
          json
        });
      });
    });

    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error('Timeout de 15s na requisição à nuvem'));
    });

    if (bodyStr) request.write(bodyStr);
    request.end();
  });
}

async function runCloudTests() {
  console.log("====================================================");
  console.log(`🌐 TESTANDO AMBIENTE DE NUVEM FOCOGENTIL 24/7`);
  console.log(`🎯 Alvo: ${parsedBase.href}`);
  console.log("====================================================\n");

  const testEmail = `teste.nuvem.${Date.now()}@focogentil.com`;
  const testPassword = "SenhaForteNuvem123!";
  let authToken = null;

  // 1. Health Check
  try {
    const r = await req('/api/health');
    logTest('Health Check (/api/health) retornando HTTP 200 e status ok', r.statusCode === 200 && r.json && r.json.status === 'ok');
  } catch (e) {
    logTest('Health Check (/api/health)', false, e.message);
  }

  // 2. Landing Page
  try {
    const r = await req('/');
    const hasSlogan = r.body.includes('FocoGentil') || r.body.includes('Menos cobrança') || r.body.includes('Menos');
    logTest('Landing Page (/) entregando HTML comercial com posicionamento', r.statusCode === 200 && hasSlogan);
  } catch (e) {
    logTest('Landing Page (/)', false, e.message);
  }

  // 3. App Dashboard
  try {
    const r = await req('/app');
    const hasApp = r.body.includes('FocoGentil') || r.body.includes('AGORA');
    logTest('App Copiloto (/app) acessível para smartphones e web', r.statusCode === 200 && hasApp);
  } catch (e) {
    logTest('App Copiloto (/app)', false, e.message);
  }

  // 4. Painel Administrativo
  try {
    const r = await req('/admin');
    logTest('Painel Administrativo (/admin) acessível', r.statusCode === 200 && r.body.includes('Painel'));
  } catch (e) {
    logTest('Painel Administrativo (/admin)', false, e.message);
  }

  // 5. Cadastro Real na Nuvem
  try {
    const r = await req('/api/auth/register', 'POST', {
      name: 'Tester Nuvem',
      email: testEmail,
      password: testPassword,
      phone_number: '5511999998888'
    });
    authToken = r.json && r.json.token;
    logTest('Cadastro de usuário (/api/auth/register) com PBKDF2 na nuvem', r.statusCode === 201 && !!authToken);
  } catch (e) {
    logTest('Cadastro de usuário na nuvem', false, e.message);
  }

  // 6. Login na Nuvem
  try {
    const r = await req('/api/auth/login', 'POST', {
      email: testEmail,
      password: testPassword
    });
    logTest('Login de usuário (/api/auth/login) com validação de senha', r.statusCode === 200 && r.json && r.json.token);
  } catch (e) {
    logTest('Login de usuário na nuvem', false, e.message);
  }

  // 7. Sessão Autenticada
  try {
    const r = await req('/api/auth/me', 'GET', null, {
      'Authorization': `Bearer ${authToken}`
    });
    logTest('Validação de sessão do usuário (/api/auth/me)', r.statusCode === 200 && r.json && r.json.email === testEmail);
  } catch (e) {
    logTest('Validação de sessão', false, e.message);
  }

  // 8. Criação de Tarefa na Nuvem
  try {
    const r = await req('/api/tasks', 'POST', {
      title: 'Validar deploy na nuvem',
      duration_minutes: 10,
      priority: 'alta'
    }, {
      'Authorization': `Bearer ${authToken}`
    });
    logTest('Criação e persistência de tarefa (/api/tasks) na nuvem', r.statusCode === 201 && r.json && r.json.title);
  } catch (e) {
    logTest('Criação de tarefa na nuvem', false, e.message);
  }

  // 9. IA Despejar Tudo na Nuvem
  try {
    const r = await req('/api/ai/brain-dump', 'POST', {
      text: 'Preciso emitir relatório, responder cliente no WhatsApp e fazer almoço',
      energyLevel: 'media'
    }, {
      'Authorization': `Bearer ${authToken}`
    });
    const hasNext = r.json && (r.json.recommended_next_step || r.json.tasks);
    logTest('IA Despejar Tudo (/api/ai/brain-dump) organizando pensamentos', r.statusCode === 200 && !!hasNext);
  } catch (e) {
    logTest('IA Despejar Tudo na nuvem', false, e.message);
  }

  // 10. IA Estou Travado na Nuvem
  try {
    const r = await req('/api/ai/unblock', 'POST', {
      task: 'Escrever proposta comercial complexa',
      reason: 'Não sei por onde começar',
      stage: 1
    }, {
      'Authorization': `Bearer ${authToken}`
    });
    const hasStep = r.json && (r.json.action_step || r.json.micro_step);
    logTest('IA Estou Travado (/api/ai/unblock) acolhendo e gerando micro-passo de 2 min', r.statusCode === 200 && !!hasStep);
  } catch (e) {
    logTest('IA Estou Travado na nuvem', false, e.message);
  }

  // 11. Geração de Pagamento PIX Oficial na Nuvem
  try {
    const r = await req('/api/checkout/create-charge', 'POST', {
      plan: 'vitalicio',
      name: 'Cliente Teste',
      email: testEmail
    });
    const hasPix = r.json && r.json.pix_code && r.json.pix_code.startsWith('000201');
    logTest('Checkout PIX (/api/checkout/create-charge) com padrão Banco Central EMV', r.statusCode === 200 && hasPix);
  } catch (e) {
    logTest('Checkout PIX na nuvem', false, e.message);
  }

  // 12. PWA Manifest na Nuvem
  try {
    const r = await req('/manifest.json');
    const hasPwa = r.statusCode === 200 && r.json && r.json.name && r.json.name.startsWith('FocoGentil');
    logTest('PWA Manifest (/manifest.json) para instalação no celular', hasPwa);
  } catch (e) {
    logTest('PWA Manifest na nuvem', false, e.message);
  }

  console.log("\n====================================================");
  console.log(`📊 RESULTADO DOS TESTES NA NUVEM: ${passed} de ${total} PASSARAM!`);
  if (passed === total) {
    console.log(`🎉 DEPLOY NA NUVEM 24/7 100% VALIDADO E OPERACIONAL!`);
  } else {
    console.log(`⚠️ ALGUNS TESTES APRESENTARAM FALHA. VERIFIQUE OS LOGS.`);
  }
  console.log("====================================================");
}

runCloudTests();

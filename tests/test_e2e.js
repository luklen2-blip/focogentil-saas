/**
 * Suíte de Testes End-to-End (E2E) para o FocoGentil Copilot
 * Valida todos os fluxos críticos da aplicação rodando com o servidor HTTP ativo.
 */

const http = require('http');
const assert = require('assert');
const { server } = require('../server');

const TEST_PORT = 3999;
let testPassed = 0;
let testTotal = 0;

function it(desc, fn) {
  testTotal++;
  return fn()
    .then(() => {
      console.log(`✅ [E2E PASSOU] ${desc}`);
      testPassed++;
    })
    .catch((err) => {
      console.error(`❌ [E2E FALHOU] ${desc}`);
      console.error(err);
    });
}

function request(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      host: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runE2ETests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO TESTES END-TO-END DO PRODUTO FINAL');
  console.log('====================================================\n');

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const testPhone = '+55819' + Math.floor(1000000 + Math.random() * 9000000);
  const encodedPhone = encodeURIComponent('whatsapp:' + testPhone);

  try {
    // 1. Teste de Período de Teste e Bloqueio após 30 minutos
    await it('Usuário novo recebe 30 minutos grátis; após 30 min, somente PIX ou Cartão libera o acesso', async () => {
      // Mensagem dentro dos 30 minutos: usuário atendido gratuitamente
      const resTrial = await request('/api/webhook/twilio', 'POST', `From=${encodedPhone}&Body=Quero+organizar+meu+dia`, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      assert.strictEqual(resTrial.status, 200);
      assert(resTrial.body.includes('Passo 1'), 'Usuário novo deve ser atendido durante o teste de 30 min');

      // Simula expiração dos 30 minutos
      const db = require('../database');
      db.expireTrialNow(testPhone);

      // Nova mensagem após 30 minutos: bloqueio e pedido de pagamento exclusivo por PIX ou Cartão
      const resExpired = await request('/api/webhook/twilio', 'POST', `From=${encodedPhone}&Body=Quero+continuar`, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      assert.strictEqual(resExpired.status, 200);
      assert(resExpired.body.includes('Seus 30 minutos de teste gratuito se esgotaram'), 'Deve informar expiração');
      assert(resExpired.body.includes('PIX') && resExpired.body.includes('Cartão'), 'Deve exigir PIX ou Cartão');
    });

    // 2. Teste de Rejeição de Assinatura Recorrente no Webhook
    await it('Webhook de pagamento rejeita transações que tenham assinatura recorrente (is_recurring: true)', async () => {
      const res = await request('/api/webhook/payment', 'POST', {
        phone_number: testPhone,
        payment_id: 'SUB_INVALIDA',
        amount: 29.90,
        is_recurring: true
      });
      assert.strictEqual(res.status, 400);
      const json = JSON.parse(res.body);
      assert(json.error.includes('Apenas pagamentos únicos'));
    });

    // 3. Teste de Ativação de Pagamento Único (PIX / Cartão)
    await it('Webhook ativa o número de WhatsApp com licença vitalícia após compra avulsa', async () => {
      const res = await request('/api/webhook/payment', 'POST', {
        phone_number: testPhone,
        customer_name: 'Luciano Neuro',
        payment_id: 'PIX_LIFETIME_888',
        amount: 97.00,
        provider: 'mercadopago',
        is_recurring: false
      });
      assert.strictEqual(res.status, 200);
      const json = JSON.parse(res.body);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.user.is_lifetime_active, true);
      assert.strictEqual(json.user.has_recurring_subscription, false);
    });

    // 4. Teste de Decomposição de Tarefa no WhatsApp após Ativação
    await it('Usuário ativado recebe decomposição com passo de ignição e opções 1, 2, 3', async () => {
      const res = await request('/api/webhook/twilio', 'POST', `From=${encodedPhone}&Body=Preciso+arrumar+minha+mesa+de+estudo`, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      assert.strictEqual(res.status, 200);
      assert(res.body.includes('Passo 1'), 'Deve ter o Passo 1');
      assert(res.body.includes('*1* - Concluí'), 'Deve conter opção rápida 1');
      assert(res.body.includes('*2* - Travei'), 'Deve conter opção rápida 2');
      assert(res.body.includes('*3* - Pausa'), 'Deve conter opção rápida 3');
    });

    // 5. Teste de Resposta Rápida 1 (Celebração da Micro-Vitória)
    await it('Resposta 1 do usuário celebra a micro-vitória com mensagem positiva', async () => {
      const res = await request('/api/webhook/twilio', 'POST', `From=${encodedPhone}&Body=1`, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      assert.strictEqual(res.status, 200);
      assert(res.body.includes('Parabéns') || res.body.includes('vitória') || res.body.includes('concluiu'));
    });

    // 6. Teste de Resposta Rápida 2 (Fatiamento Menor Anti-Bloqueio)
    await it('Resposta 2 do usuário reduz a ação para micro-passo de 2 minutos sem julgamento', async () => {
      const res = await request('/api/webhook/twilio', 'POST', `From=${encodedPhone}&Body=2`, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      assert.strictEqual(res.status, 200);
      assert(res.body.includes('fatiar') || res.body.includes('Sem crise'));
    });

    // 7. Teste de Simulação via Interface Web (JSON API)
    await it('API do Simulador Web funciona com suporte a Teoria das Colheres (energia)', async () => {
      const res = await request('/api/simulate', 'POST', {
        phone: testPhone,
        message: 'Preparar almoço saudável',
        energy: 'baixa',
        is_audio: false
      });
      assert.strictEqual(res.status, 200);
      const json = JSON.parse(res.body);
      assert.strictEqual(json.is_authorized, true);
      assert.strictEqual(json.breakdown.energy_level, 'baixa');
      assert(json.breakdown.micro_tasks[0].duration_minutes <= 3);
    });

    // 8. Teste de Nota de Voz no Simulador
    await it('API do Simulador processa mensagem de áudio simulada para facilidade neurodivergente', async () => {
      const res = await request('/api/simulate', 'POST', {
        phone: testPhone,
        message: '',
        energy: 'media',
        is_audio: true
      });
      assert.strictEqual(res.status, 200);
      const json = JSON.parse(res.body);
      assert(json.breakdown.project_title.length > 0);
    });

    // 9. Teste de Arquivos Estáticos (Simulador WhatsApp Preservado e Checkout)
    await it('Servidor HTTP entrega a página do Simulador e a página de Checkout', async () => {
      const resSim = await request('/simulador.html');
      assert.strictEqual(resSim.status, 200);
      assert(resSim.body.includes('FocoGentil - Simulador do WhatsApp'));

      const resCheckout = await request('/checkout.html');
      assert.strictEqual(resCheckout.status, 200);
      assert(resCheckout.body.includes('Acesso Vitalício'));
    });

  } finally {
    server.close();
  }

  console.log(`\n====================================================`);
  console.log(`RESULTADO E2E: ${testPassed} de ${testTotal} testes passaram com sucesso! 🚀`);
  console.log(`====================================================`);

  if (testPassed !== testTotal) {
    process.exit(1);
  }
}

runE2ETests();

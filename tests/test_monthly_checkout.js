/**
 * Teste Específico: Validação da Forma de Pagamento e Assinatura do Plano Pro Mensal
 */

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { server } = require('../server');
const db = require('../database');

const TEST_PORT = 3998;

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

async function runTests() {
  console.log('====================================================');
  console.log('💳 TESTES DO PLANO MENSAL E FORMAS DE PAGAMENTO');
  console.log('====================================================\n');

  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // 1. Assinatura via Cartão Recorrente
    const testEmail = `mensal_${Date.now()}@teste.com`;
    const testPhone = '+55119' + Math.floor(1000000 + Math.random() * 9000000);

    const subRes = await request('/api/subscription/subscribe', 'POST', {
      email: testEmail,
      phone: testPhone,
      name: 'Cliente Assinante Mensal',
      plan: 'pro',
      payment_method: 'card',
      amount: 29.00
    });
    assert.strictEqual(subRes.status, 200, 'Endpoint /api/subscription/subscribe deve retornar 200');
    const subData = JSON.parse(subRes.body);
    assert.strictEqual(subData.success, true);
    assert.strictEqual(subData.plan, 'pro');
    assert.strictEqual(subData.amount, 29.00);

    const user = db.getUser(testPhone);
    assert.strictEqual(user.plan, 'pro', 'Usuário deve estar no plano Pro');
    assert.strictEqual(user.has_recurring_subscription, true, 'Deve ter flag de assinatura recorrente');
    console.log('✅ [PASSOU] Assinatura do Plano Pro Mensal via Cartão de Crédito');

    // 2. Geração e Confirmação de PIX Mensal (R$ 29,00)
    const pixPhone = '+55119' + Math.floor(1000000 + Math.random() * 9000000);
    const pixCreateRes = await request('/api/pix/create', 'POST', {
      phone: pixPhone,
      name: 'Cliente PIX Mensal',
      amount: 29.00,
      plan: 'pro'
    });
    assert.strictEqual(pixCreateRes.status, 200);
    const pixData = JSON.parse(pixCreateRes.body);
    assert.strictEqual(pixData.amount, 29.00, 'PIX deve ser gerado no valor de R$ 29,00');
    assert(pixData.pix_code.length > 20, 'Deve gerar código PIX Copia e Cola válido');
    assert(pixData.qr_code_url.includes('qrserver'), 'Deve gerar URL do QR Code');
    console.log('✅ [PASSOU] Geração de QR Code e Copia e Cola PIX Mensal de R$ 29,00');

    const pixConfirmRes = await request('/api/pix/confirm', 'POST', {
      phone: pixPhone,
      name: 'Cliente PIX Mensal',
      amount: 29.00,
      plan: 'pro',
      admin_override: true
    });
    assert.strictEqual(pixConfirmRes.status, 200);
    const confirmData = JSON.parse(pixConfirmRes.body);
    assert.strictEqual(confirmData.success, true);
    assert.strictEqual(confirmData.plan, 'pro');

    const pixUser = db.getUser(pixPhone);
    assert.strictEqual(pixUser.plan, 'pro', 'Usuário PIX Mensal deve ser ativado como Pro');
    console.log('✅ [PASSOU] Confirmação de pagamento do PIX Mensal ativa o plano Pro');

    // 3. Inspeção do HTML de checkout.html
    const checkoutHtml = fs.readFileSync(path.join(__dirname, '../public/checkout.html'), 'utf8');
    assert(checkoutHtml.includes('tabMensal'), 'checkout.html deve ter a aba do Plano Mensal');
    assert(checkoutHtml.includes('tabVitalicio'), 'checkout.html deve ter a aba do Plano Vitalício');
    assert(checkoutHtml.includes('switchPlan'), 'checkout.html deve ter função switchPlan');
    assert(checkoutHtml.includes('cardNumber'), 'checkout.html deve exibir campos de cartão de crédito');
    assert(checkoutHtml.includes('cardExpiry'), 'checkout.html deve conter campo de validade do cartão');
    assert(checkoutHtml.includes('cardCvv'), 'checkout.html deve conter campo de CVV');
    assert(checkoutHtml.includes('incomingPlan === \'mensal\''), 'checkout.html deve ler o parâmetro ?plan=mensal da URL');
    assert(checkoutHtml.includes('/api/subscription/subscribe'), 'checkout.html deve chamar o endpoint de assinatura');
    console.log('✅ [PASSOU] checkout.html possui seletor de planos, campos de cartão e leitura de ?plan=mensal');

    // 4. Inspeção do HTML de index.html
    const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    assert(indexHtml.includes('/checkout.html?plan=mensal'), 'index.html deve direcionar botão Assinar Pro para /checkout.html?plan=mensal');
    assert(indexHtml.includes('/checkout.html?plan=vitalicio'), 'index.html deve direcionar botão Vitalício para /checkout.html?plan=vitalicio');
    console.log('✅ [PASSOU] index.html conecta CTAs diretamente aos respectivos planos no checkout');

    // 5. Inspeção do HTML de app.html
    const appHtml = fs.readFileSync(path.join(__dirname, '../public/app.html'), 'utf8');
    assert(appHtml.includes('/checkout.html?plan=mensal'), 'app.html deve oferecer link para o Plano Pro Mensal');
    assert(appHtml.includes('/checkout.html?plan=vitalicio'), 'app.html deve oferecer link para o Plano Vitalício');
    console.log('✅ [PASSOU] app.html disponibiliza botões de upgrade para ambos os planos');

    console.log('\n====================================================');
    console.log('🎉 TODOS OS TESTES DO PLANO MENSAL PASSARAM COM SUCESSO!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ FALHA NO TESTE DO PLANO MENSAL:', err);
  process.exit(1);
});

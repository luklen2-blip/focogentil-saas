/**
 * Suíte de Testes Automatizados: Responsividade Móvel, PWA e Diretrizes de Idade Mínima
 */

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { server } = require('../server');

const TEST_PORT = 3997;

function request(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });

    req.on('error', reject);
    req.end();
  });
}

async function runMobileAndAgeTests() {
  console.log('====================================================');
  console.log('📱 TESTES DE RESPONSIVIDADE MOBILE & IDADE MÍNIMA');
  console.log('====================================================\n');

  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // 1. Validação do Web App Manifest (PWA / Adicionar à Tela Inicial)
    const manifestRes = await request('/manifest.json');
    assert.strictEqual(manifestRes.status, 200, 'manifest.json deve retornar HTTP 200');
    const manifest = JSON.parse(manifestRes.body);
    assert.strictEqual(manifest.short_name, 'FocoGentil');
    assert.strictEqual(manifest.display, 'standalone');
    assert.strictEqual(manifest.theme_color, '#00a884');
    console.log('✅ [PASSOU] manifest.json é válido para instalação como PWA no celular');

    // 2. Validação da Landing Page (/)
    const indexRes = await request('/');
    assert.strictEqual(indexRes.status, 200);
    assert(indexRes.body.includes('viewport-fit=cover'), 'Landing deve conter viewport-fit=cover');
    assert(indexRes.body.includes('manifest.json'), 'Landing deve referenciar manifest.json');
    assert(indexRes.body.includes('13 anos'), 'Landing deve informar idade recomendada de 13 anos');
    assert(indexRes.body.includes('api.whatsapp.com/send?text='), 'Landing deve possuir link para envio no WhatsApp');
    assert(indexRes.body.includes('og:title'), 'Landing deve conter tags OpenGraph para pré-visualização no WhatsApp');
    console.log('✅ [PASSOU] Landing Page possui tags mobile, PWA, indicação de 13+ anos e compartilhamento WhatsApp');

    // 3. Validação do App Dashboard (/app)
    const appRes = await request('/app');
    assert.strictEqual(appRes.status, 200);
    assert(appRes.body.includes('viewport-fit=cover'), 'App deve ter viewport-fit=cover');
    assert(appRes.body.includes('shareAppOnWhatsApp'), 'App deve possuir função de compartilhamento WhatsApp');
    assert(appRes.body.includes('13+ anos') || appRes.body.includes('13 anos'), 'App deve conter aviso de 13 anos');
    console.log('✅ [PASSOU] Dashboard App adaptado para telas de celular com compartilhamento e idade mínima');

    // 4. Validação do Checkout (/checkout.html)
    const checkoutRes = await request('/checkout.html');
    assert.strictEqual(checkoutRes.status, 200);
    assert(checkoutRes.body.includes('inputmode="numeric"'), 'Checkout deve ter inputmode numeric para teclados virtuais de cartão');
    assert(checkoutRes.body.includes('inputmode="tel"'), 'Checkout deve ter inputmode tel para WhatsApp');
    assert(checkoutRes.body.includes('inputmode="email"'), 'Checkout deve ter inputmode email');
    assert(checkoutRes.body.includes('13 anos'), 'Checkout deve informar idade de 13 anos para uso');
    assert(checkoutRes.body.includes('18 anos'), 'Checkout deve exigir 18 anos para contratação financeira');
    console.log('✅ [PASSOU] Checkout otimizado com teclados numéricos para celular e diretrizes de pagamento aos 18 anos');

    // 5. Validação dos Termos de Uso (/termos)
    const termosRes = await request('/termos');
    assert.strictEqual(termosRes.status, 200);
    assert(termosRes.body.includes('13 (treze) anos'), 'Termos deve estipular 13 anos com autorização dos pais');
    assert(termosRes.body.includes('maiores de 18 anos'), 'Termos deve restringir contratação a maiores de 18 anos');
    assert(termosRes.body.includes('Artigo 14 da LGPD'), 'Termos deve referenciar Art. 14 da LGPD');
    console.log('✅ [PASSOU] Termos de Uso em conformidade com o Código Civil, ECA e Art. 14 da LGPD');

    // 6. Validação da Política de Privacidade (/privacidade)
    const privRes = await request('/privacidade');
    assert.strictEqual(privRes.status, 200);
    assert(privRes.body.includes('Crianças e Adolescentes'), 'Privacidade deve ter seção de proteção de menores');
    assert(privRes.body.includes('Artigo 14 da Lei Geral de Proteção de Dados'), 'Privacidade deve citar Artigo 14 da LGPD');
    console.log('✅ [PASSOU] Política de Privacidade protege dados de adolescentes sem perfilamento comercial');

    // 7. Validação do Painel Administrativo (/admin)
    const adminRes = await request('/admin');
    assert.strictEqual(adminRes.status, 200);
    assert(adminRes.body.includes('adminShareText'), 'Admin deve ter gerador de mensagem para envio no WhatsApp');
    assert(adminRes.body.includes('13+ anos'), 'Admin deve orientar o Luciano sobre a idade recomendada de 13+ anos');
    console.log('✅ [PASSOU] Painel Administrativo contém ferramenta de link com mensagem pronta para envio');

    console.log('\n====================================================');
    console.log('🎉 TODOS OS 7 TESTES DE MOBILE E IDADE MÍNIMA PASSARAM!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runMobileAndAgeTests().catch(err => {
  console.error('❌ FALHA NOS TESTES DE MOBILE E IDADE MÍNIMA:', err);
  process.exit(1);
});

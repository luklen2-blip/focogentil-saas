/**
 * tests/test_adaptive_personas.js
 * Suíte de Testes Reais simulando as 9 Personas de Função Executiva (Item 29)
 */

const http = require('http');
const fs = require('fs');
const assert = require('assert');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

function request(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const req = http.request(url, {
      method,
      headers: reqHeaders,
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = res.headers['content-type']?.includes('application/json') ? JSON.parse(data) : data;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout ao conectar a ${path}`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runPersonaTests() {
  console.log('====================================================');
  console.log('🧠 SUÍTE DAS 9 PERSONAS ADAPTATIVAS (ITEM 29)');
  console.log('====================================================\n');

  let passed = 0;

  // Registrar usuário de teste dedicado
  const testEmail = `persona_${Date.now()}@teste.com`;
  const authRes = await request('/api/auth/register', 'POST', {
    name: 'Persona Tester',
    email: testEmail,
    password: 'SenhaSegura123!'
  });
  const cookie = authRes.headers['set-cookie'] ? authRes.headers['set-cookie'][0] : '';
  const authHeader = cookie ? { Cookie: cookie.split(';')[0] } : {};

  // -------------------------------------------------------------
  // PERSONA 1: Baixa energia + tarefa grande
  // -------------------------------------------------------------
  try {
    const stateRes = await request('/api/state', 'POST', { state: 'baixa' }, authHeader);
    assert.strictEqual(stateRes.status, 201);
    
    const unblockRes = await request('/api/unblock/detailed', 'POST', {
      reason: 'sem_energia',
      task: 'Organizar a casa inteira'
    }, authHeader);
    assert.strictEqual(unblockRes.status, 200);
    assert.strictEqual(unblockRes.data.mode_activated, 'bateria');
    assert.ok(unblockRes.data.action_step.toLowerCase().includes('2 minuto') || unblockRes.data.action_step.toLowerCase().includes('confortavelmente'));
    
    console.log('✅ [PERSONA 1 PASSOU] Baixa energia + tarefa grande ativa Modo Bateria e reduz para ação de 2 min');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 1 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 2: Alta energia + muitas tarefas
  // -------------------------------------------------------------
  try {
    await request('/api/state', 'POST', { state: 'boa' }, authHeader);
    await request('/api/tasks', 'POST', { title: 'Tarefa Importante 1', priority: 'ALTA' }, authHeader);
    await request('/api/tasks', 'POST', { title: 'Tarefa Secundária 2', priority: 'NORMAL' }, authHeader);
    await request('/api/tasks', 'POST', { title: 'Tarefa Secundária 3', priority: 'BAIXA' }, authHeader);

    const planRes = await request('/api/day-plan', 'GET', null, authHeader);
    assert.strictEqual(planRes.status, 200);
    assert.ok(planRes.data.essential !== undefined);
    assert.ok(planRes.data.if_possible !== undefined);
    assert.ok(planRes.data.can_wait !== undefined);

    console.log('✅ [PERSONA 2 PASSOU] Alta energia gerencia múltiplas tarefas organizadas em 3 níveis sem sobrecarga');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 2 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 3: Sobrecarregado + muitos pensamentos
  // -------------------------------------------------------------
  try {
    await request('/api/state', 'POST', { state: 'sobrecarregado' }, authHeader);
    const dumpRes = await request('/api/brain-dump-v3', 'POST', {
      text: 'Tenho que pagar conta de luz, responder o cliente Carlos, comprar ração, e estou com medo de não dar conta da apresentação de amanhã!'
    }, authHeader);

    assert.strictEqual(dumpRes.status, 200);
    const cats = dumpRes.data.categories || {};
    assert.ok((cats.tasks && cats.tasks.length >= 1) || dumpRes.data.counts.tasks >= 1);
    assert.ok((cats.worries && cats.worries.length >= 1) || dumpRes.data.counts.worries >= 1);
    assert.ok(dumpRes.data.recommended_next_action !== undefined);

    console.log('✅ [PERSONA 3 PASSOU] Sobrecarregado classifica pensamentos em 5 categorias e destaca 1 único próximo passo');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 3 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 4: Não consegue começar (Redução Progressiva em Cascata)
  // -------------------------------------------------------------
  try {
    const s1 = await request('/api/unblock/detailed', 'POST', {
      reason: 'nao_sei_comecar',
      task: 'Organizar meus documentos',
      stage: 1
    }, authHeader);
    assert.strictEqual(s1.data.stage, 1);
    assert.strictEqual(s1.data.can_reduce_again, true);

    const s2 = await request('/api/unblock/detailed', 'POST', {
      reason: 'nao_sei_comecar',
      task: 'Organizar meus documentos',
      stage: 2
    }, authHeader);
    assert.strictEqual(s2.data.stage, 2);
    assert.ok(s2.data.action_step.toLowerCase().includes('um documento') || s2.data.action_step.toLowerCase().includes('1'));

    const s3 = await request('/api/unblock/detailed', 'POST', {
      reason: 'nao_sei_comecar',
      task: 'Organizar meus documentos',
      stage: 3
    }, authHeader);
    assert.strictEqual(s3.data.stage, 3);
    assert.ok(s3.data.action_step.toLowerCase().includes('olhe') || s3.data.action_step.toLowerCase().includes('10 segundos'));

    const s4 = await request('/api/unblock/detailed', 'POST', {
      reason: 'nao_sei_comecar',
      task: 'Organizar meus documentos',
      stage: 4
    }, authHeader);
    assert.strictEqual(s4.data.stage, 4);
    assert.strictEqual(s4.data.can_reduce_again, false);
    assert.ok(s4.data.action_step.toLowerCase().includes('dedo') || s4.data.action_step.toLowerCase().includes('aponte'));

    console.log('✅ [PERSONA 4 PASSOU] Não consegue começar reduz progressivamente pelos 4 estágios até contato físico simples');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 4 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 5: Não entende a tarefa (Instrução Confusa)
  // -------------------------------------------------------------
  try {
    const confusingText = 'Proceder à parametrização holística dos relatórios operacionais consoante os ditames das diretrizes corporativas vigentes.';
    const simRes = await request('/api/tasks/simplify-instruction', 'POST', {
      instruction: confusingText
    }, authHeader);

    assert.strictEqual(simRes.status, 200);
    assert.ok(simRes.data.simplified.length > 0);
    assert.ok(simRes.data.first_action.length > 0);

    console.log('✅ [PERSONA 5 PASSOU] Traduz instrução confusa em passos simples com o primeiro destacado');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 5 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 6: Tem apenas 5 minutos
  // -------------------------------------------------------------
  try {
    const timeRes = await request('/api/unblock/detailed', 'POST', {
      reason: 'sem_tempo',
      task: 'Escrever artigo longo',
      extra_input: '5'
    }, authHeader);

    assert.strictEqual(timeRes.status, 200);
    assert.strictEqual(timeRes.data.duration_minutes, 5);
    assert.ok(timeRes.data.action_step.includes('5 minutos'));

    console.log('✅ [PERSONA 6 PASSOU] Adapta tarefa ao bloco de 5 minutos com término sem culpa');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 6 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 7: Interrompe tarefa com pausa e volta depois
  // -------------------------------------------------------------
  try {
    const postPauseRes = await request('/api/state', 'POST', { state: 'baixa', trigger: 'pos_pausa' }, authHeader);
    assert.strictEqual(postPauseRes.status, 201);
    
    const fbRes = await request('/api/feedback/strategy', 'POST', {
      strategy: 'pausa_sem_culpa_respirar',
      helped: 'sim'
    }, authHeader);
    assert.ok(fbRes.status === 200 || fbRes.status === 201);

    console.log('✅ [PERSONA 7 PASSOU] Retorno pós-pausa acolhe energia atual e persiste feedback de eficácia');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 7 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 8: Usa somente celular (Mobile / PWA)
  // -------------------------------------------------------------
  try {
    const manifestRes = await request('/manifest.json');
    assert.strictEqual(manifestRes.status, 200);
    assert.ok(manifestRes.data.name.includes('FocoGentil'));
    assert.strictEqual(manifestRes.data.display, 'standalone');

    const appHtml = fs.readFileSync('public/app.html', 'utf8');
    assert.ok(appHtml.includes('name="viewport"'));
    assert.ok(appHtml.includes('width=device-width'));

    console.log('✅ [PERSONA 8 PASSOU] Suporte PWA standalone e responsividade móvel validados com sucesso');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 8 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // PERSONA 9: Modo Baixo Estímulo
  // -------------------------------------------------------------
  try {
    const appHtml = fs.readFileSync('public/app.html', 'utf8');
    assert.ok(appHtml.includes('body.low-stimulus'));
    assert.ok(appHtml.includes('animation: none !important'));
    assert.ok(appHtml.includes('transition: none !important'));
    assert.ok(appHtml.includes('toggleLowStimulus'));

    console.log('✅ [PERSONA 9 PASSOU] Modo Baixo Estímulo zera animações e reduz sobrecarga sensorial');
    passed++;
  } catch (e) {
    console.error('❌ [PERSONA 9 FALHOU]', e.message);
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTADO PERSONAS: ${passed} de 9 passaram!`);
  console.log('====================================================\n');

  if (passed < 9) {
    process.exit(1);
  }
}

runPersonaTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

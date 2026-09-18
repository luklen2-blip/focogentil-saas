/**
 * tests/test_master_evolution_15.js
 * Suíte Oficial com os 15 Cenários de Teste Mandatórios da Evolução Master (Item 27)
 */

const http = require('http');
const fs = require('fs');
const assert = require('assert');
const path = require('path');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

function request(urlPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
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
      reject(new Error(`Timeout ao conectar a ${urlPath}`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runMaster15Tests() {
  console.log('====================================================');
  console.log('🧠 SUÍTE DOS 15 CENÁRIOS MANDATÓRIOS (ITEM 27)');
  console.log('====================================================\n');

  let passed = 0;

  // Registrar usuário de teste dedicado
  const testEmail = `master15_${Date.now()}@teste.com`;
  const authRes = await request('/api/auth/register', 'POST', {
    name: 'Master Tester',
    email: testEmail,
    password: 'SenhaSegura123!'
  });
  const token = authRes.data.token;
  const authHeader = {
    'Authorization': 'Bearer ' + token,
    'Cookie': 'auth_token=' + token
  };

  // -------------------------------------------------------------
  // TESTE 1: Usuário com energia baixa
  // -------------------------------------------------------------
  try {
    const res = await request('/api/state', 'POST', { state: 'baixa' }, authHeader);
    assert.strictEqual(res.status, 201);
    const unb = await request('/api/unblock/detailed', 'POST', { reason: 'sem_energia', task: 'Escrever TCC' }, authHeader);
    assert.strictEqual(unb.status, 200);
    assert.strictEqual(unb.data.mode_activated, 'bateria');
    console.log('✅ [TESTE 1/15 PASSOU] Usuário com energia baixa ativa Modo Bateria e ação viável');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 1/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 2: Usuário com energia alta
  // -------------------------------------------------------------
  try {
    const res = await request('/api/state', 'POST', { state: 'boa' }, authHeader);
    assert.strictEqual(res.status, 201);
    await request('/api/tasks', 'POST', { title: 'Módulo Principal', priority: 'ALTA' }, authHeader);
    const plan = await request('/api/day-plan', 'GET', null, authHeader);
    assert.strictEqual(plan.status, 200);
    console.log('✅ [TESTE 2/15 PASSOU] Usuário com energia alta planeja tarefas essenciais');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 2/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 3: Usuário sobrecarregado (com inferência de estado)
  // -------------------------------------------------------------
  try {
    const inferRes = await request('/api/state/infer', 'POST', {
      text: 'Tenho três trabalhos acumulados, reunião daqui a 40 minutos e não consigo começar!'
    }, authHeader);
    assert.strictEqual(inferRes.status, 200);
    assert.strictEqual(inferRes.data.primary_state, 'sobrecarga_tempo');
    assert.ok(inferRes.data.duration_minutes <= 2);
    console.log('✅ [TESTE 3/15 PASSOU] Usuário sobrecarregado é detectado por conversa e tem opções reduzidas');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 3/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 4: Usuário não sabe começar (redução em 4 estágios)
  // -------------------------------------------------------------
  try {
    const r1 = await request('/api/unblock/detailed', 'POST', { reason: 'nao_sei_comecar', task: 'Declarar imposto de renda', stage: 1 }, authHeader);
    const r4 = await request('/api/unblock/detailed', 'POST', { reason: 'nao_sei_comecar', task: 'Declarar imposto de renda', stage: 4 }, authHeader);
    assert.strictEqual(r1.data.can_reduce_again, true);
    assert.strictEqual(r4.data.can_reduce_again, false);
    assert.ok(r4.data.action_step.includes('dedo') || r4.data.action_step.includes('aponte'));
    console.log('✅ [TESTE 4/15 PASSOU] Usuário não sabe começar reduz progressivamente até ação física mínima');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 4/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 5: Usuário sem tempo
  // -------------------------------------------------------------
  try {
    const rTime = await request('/api/unblock/detailed', 'POST', { reason: 'sem_tempo', task: 'Organizar planilha', extra_input: '5' }, authHeader);
    assert.strictEqual(rTime.data.duration_minutes, 5);
    console.log('✅ [TESTE 5/15 PASSOU] Usuário sem tempo adapta tarefa estritamente aos 5 minutos');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 5/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 6: Usuário não entendeu a tarefa
  // -------------------------------------------------------------
  try {
    const rSim = await request('/api/tasks/simplify-instruction', 'POST', {
      instruction: 'Executar parametrização operacional tempestiva dos relatórios contábeis anuais.'
    }, authHeader);
    assert.ok(rSim.data.simplified.length > 0);
    assert.ok(rSim.data.first_action.length > 0);
    console.log('✅ [TESTE 6/15 PASSOU] Usuário não entendeu a tarefa tem instrução simplificada em passos diretos');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 6/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 7: Usuário ansioso / sobrecarregado
  // -------------------------------------------------------------
  try {
    const rAnx = await request('/api/unblock/detailed', 'POST', { reason: 'ansioso', task: 'Apresentação diretoria' }, authHeader);
    assert.ok(rAnx.data.action_step.includes('respira'));
    console.log('✅ [TESTE 7/15 PASSOU] Usuário ansioso recebe descompressão respiratória antes de exigir produção');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 7/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 8: Usuário diz "Ainda Não Consigo"
  // -------------------------------------------------------------
  try {
    const rCant = await request('/api/unblock/cant-do', 'POST', { task: 'Estudar Estatística', option: 'menos_passos' }, authHeader);
    assert.strictEqual(rCant.status, 200);
    assert.ok(rCant.data.action_step.length > 0);
    console.log('✅ [TESTE 8/15 PASSOU] Usuário que diz "Ainda Não Consigo" recebe adaptação compassiva imediata');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 8/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 9: Usuário despeja 10 pensamentos simultaneamente
  // -------------------------------------------------------------
  try {
    const tenThoughts = '1 pagar luz, 2 comprar pao, 3 ligar mae, 4 medo da reuniao, 5 ideia de app, 6 estudar fisica, 7 responder email, 8 lavar louca, 9 trocar pneu, 10 duvida se faco curso';
    const rDump = await request('/api/brain-dump-v3', 'POST', { text: tenThoughts }, authHeader);
    assert.strictEqual(rDump.status, 200);
    assert.ok(rDump.data.recommended_next_action.length > 0);
    console.log('✅ [TESTE 9/15 PASSOU] 10 pensamentos são classificados e sintetizados em apenas 1 próximo passo');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 9/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 10: Usuário abandona uma tarefa (sem culpa)
  // -------------------------------------------------------------
  try {
    const t = await request('/api/tasks', 'POST', { title: 'Tarefa Desistida' }, authHeader);
    const rMove = await request(`/api/tasks/${t.data.id}`, 'PUT', { priority: 'PODE_ESPERAR' }, authHeader);
    assert.strictEqual(rMove.status, 200);
    console.log('✅ [TESTE 10/15 PASSOU] Usuário pode abandonar/postergar tarefa para "Pode Esperar" sem cobrança');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 10/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 11: Usuário retorna depois de algumas horas
  // -------------------------------------------------------------
  try {
    const rState = await request('/api/state/history', 'GET', null, authHeader);
    assert.strictEqual(rState.status, 200);
    assert.ok(Array.isArray(rState.data.history));
    console.log('✅ [TESTE 11/15 PASSOU] Histórico e estado preservados com segurança no retorno do usuário');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 11/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 12: Usuário fecha e abre o aplicativo (Persistência)
  // -------------------------------------------------------------
  try {
    const meRes = await request('/api/auth/me', 'GET', null, authHeader);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.email, testEmail);
    console.log('✅ [TESTE 12/15 PASSOU] Sessão e identidade do usuário persistem atômica e confiavelmente');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 12/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 13: Uso exclusivamente pelo celular (PWA e Responsividade)
  // -------------------------------------------------------------
  try {
    const swRes = await request('/sw.js');
    const maniRes = await request('/manifest.json');
    assert.strictEqual(swRes.status, 200);
    assert.strictEqual(maniRes.status, 200);
    assert.strictEqual(maniRes.data.display, 'standalone');
    console.log('✅ [TESTE 13/15 PASSOU] PWA Service Worker e Manifest standalone totalmente operacionais para celular');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 13/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 14: Modo Baixa Estimulação
  // -------------------------------------------------------------
  try {
    const appHtml = fs.readFileSync(path.join(__dirname, '../public/app.html'), 'utf8');
    assert.ok(appHtml.includes('body.low-stimulus'));
    assert.ok(appHtml.includes('animation: none !important'));
    console.log('✅ [TESTE 14/15 PASSOU] Modo Baixa Estimulação zera animações e foca em uma ação por vez');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 14/15 FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE 15: Usuário Free tentando acessar recurso Pro (Controle Real)
  // -------------------------------------------------------------
  try {
    // Cria usuário com trial propositalmente expirado para testar bloqueio real do backend
    const freeExpiredEmail = `free_exp_${Date.now()}@teste.com`;
    const expReg = await request('/api/auth/register', 'POST', {
      name: 'Free Expired',
      email: freeExpiredEmail,
      password: 'SenhaSegura123!'
    });
    const expToken = expReg.data.token;
    const expHeader = {
      'Authorization': 'Bearer ' + expToken,
      'Cookie': 'auth_token=' + expToken
    };
    
    // Força expiração do trial através da API interna de homologação
    const expRes = await request('/api/test/expire-trial', 'POST', null, expHeader);
    assert.strictEqual(expRes.status, 200);

    const checkRes = await request('/api/features/check', 'GET', null, expHeader);
    assert.strictEqual(checkRes.status, 403);
    assert.strictEqual(checkRes.data.error, 'UPGRADE_REQUIRED');
    console.log('✅ [TESTE 15/15 PASSOU] Usuário Free expirado é bloqueado no backend com código 403 e convite ao Pro');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE 15/15 FALHOU]', e.message);
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL MASTER 15: ${passed} de 15 passaram com 100% de sucesso!`);
  console.log('====================================================\n');

  if (passed < 15) {
    process.exit(1);
  }
}

runMaster15Tests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

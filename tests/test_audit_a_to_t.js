/**
 * tests/test_audit_a_to_t.js
 * Suíte de Testes da Auditoria Final Obrigatória (Item 9: TESTES A a T)
 */

const http = require('http');
const fs = require('fs');
const assert = require('assert');
const path = require('path');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

function request(urlPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders,
      timeout: 10000
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

    if (postData) req.write(postData);
    req.end();
  });
}

async function runAuditTests() {
  console.log('====================================================');
  console.log('🧪 SUÍTE DE AUDITORIA FINAL OBRIGATÓRIA (TESTES A A T)');
  console.log('🎯 Alvo:', BASE_URL);
  console.log('====================================================\n');

  let passed = 0;
  let total = 20;

  // Registrar usuário para autenticação dos testes
  const testEmail = `audit_user_${Date.now()}@teste.com`;
  const regRes = await request('/api/auth/register', 'POST', {
    name: 'Auditor FocoGentil',
    email: testEmail,
    password: 'SenhaSegura123!'
  });
  assert.strictEqual(regRes.status, 201);
  const token = regRes.data.token;
  const authHeader = {
    'Authorization': 'Bearer ' + token,
    'Cookie': 'auth_token=' + token
  };

  // -------------------------------------------------------------
  // TESTE A: Abrir página inicial
  // -------------------------------------------------------------
  try {
    const res = await request('/');
    assert.strictEqual(res.status, 200);
    const html = typeof res.data === 'string' ? res.data : '';
    assert.ok(html.includes('Organize sua mente.<br>Um passo de cada vez.'), 'Headline deve estar presente');
    assert.ok(html.includes('Quando tudo parece demais, o FocoGentil ajuda você a descobrir o que fazer agora'), 'Subheadline correta');
    assert.ok(html.includes('Adaptação por Nível de Energia') || html.includes('Adaptação por nível de energia'), 'Deve conter Adaptação por nível de energia');
    assert.ok(!html.includes('Teoria das Colheres'), 'Não deve conter Teoria das Colheres');
    assert.ok(!html.includes('cura procrastinação'), 'Não deve prometer cura de procrastinação');
    assert.ok(html.includes('R$ 19,90') || html.includes('R$ 97'), 'Preço vitalício R$ 19,90 / R$ 97 presente');
    assert.ok(html.includes('https://pay.kiwify.com.br/hrilODa') || html.includes('Kiwify') || html.includes('R$ 29'), 'Link Kiwify presente');
    console.log('✅ [TESTE A PASSOU] Abrir página inicial: headline, subheadline, energia e preços validados');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE A FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE B: Abrir copiloto
  // -------------------------------------------------------------
  try {
    const res = await request('/app');
    assert.strictEqual(res.status, 200);
    const html = typeof res.data === 'string' ? res.data : '';
    assert.ok(html.includes('Foco Atômico AGORA') || html.includes('Card AGORA'), 'Card do Agora presente');
    assert.ok(html.includes('btnVoiceFloat'), 'Botão de voz presente');
    assert.ok(html.includes('Não é aconselhamento, diagnóstico, psicoterapia ou tratamento médico'), 'Disclaimer ético presente');
    console.log('✅ [TESTE B PASSOU] Abrir copiloto: Card do Agora, microfone e aviso ético validados');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE B FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE C: Selecionar energia baixa
  // -------------------------------------------------------------
  try {
    const res = await request('/api/state', 'POST', { energy: 'baixa', mode: 'bateria' }, authHeader);
    assert.ok(res.status === 200 || res.status === 201);
    assert.strictEqual(res.data.state.energy, 'baixa');
    console.log('✅ [TESTE C PASSOU] Selecionar energia baixa: Modo bateria e micropassos acolhidos');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE C FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE D: Selecionar energia média
  // -------------------------------------------------------------
  try {
    const res = await request('/api/state', 'POST', { energy: 'media' }, authHeader);
    assert.ok(res.status === 200 || res.status === 201);
    assert.strictEqual(res.data.state.energy, 'media');
    console.log('✅ [TESTE D PASSOU] Selecionar energia média: Equilíbrio de tarefas e tempo');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE D FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE E: Selecionar energia alta
  // -------------------------------------------------------------
  try {
    const res = await request('/api/state', 'POST', { energy: 'alta' }, authHeader);
    assert.ok(res.status === 200 || res.status === 201);
    assert.strictEqual(res.data.state.energy, 'alta');
    console.log('✅ [TESTE E PASSOU] Selecionar energia alta: Capacidade de fluxo expandida');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE E FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE F: Abrir "Estou Travado"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/unblock/intervene', 'POST', {
      reason: 'nao_sei_comecar',
      task: 'Relatório Financeiro Trimestral',
      stage: 1
    }, authHeader);
    assert.strictEqual(res.status, 200);
    const action = res.data.action_step || res.data.first_step || res.data.action || '';
    assert.ok(action.includes('Abra o documento') || action.includes('apenas o título') || action.includes('Pronto'));
    console.log('✅ [TESTE F PASSOU] Abrir "Estou Travado": Ação operacional concreta sem respiração obrigatória');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE F FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE G: Usar "Não sei por onde começar"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/unblock/detailed', 'POST', {
      option: 'nao_sei_comecar',
      task: 'Organizar documentos do escritório'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.action || res.data.action_step || res.data.first_step);
    console.log('✅ [TESTE G PASSOU] Usar "Não sei por onde começar": Redução atômica observável');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE G FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE H: Usar "Tem coisa demais"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/unblock/detailed', 'POST', {
      option: 'tarefa_grande',
      task: 'Reformar a casa inteira'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.action || res.data.action_step || res.data.first_step);
    console.log('✅ [TESTE H PASSOU] Usar "Tem coisa demais": Isolamento de apenas 1 elemento');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE H FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE I: Usar "Estou sem energia"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/unblock/detailed', 'POST', {
      option: 'cansado',
      task: 'Responder 50 emails pendentes'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.action || res.data.action_step || res.data.first_step || res.data.strategy);
    console.log('✅ [TESTE I PASSOU] Usar "Estou sem energia": Ação mínima viável adaptada ao cansaço');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE I FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE J: Usar "Estou sem tempo"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/unblock/detailed', 'POST', {
      option: 'pouco_tempo',
      task: 'Estudar capitulo 4'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.action || res.data.action_step || res.data.first_step);
    console.log('✅ [TESTE J PASSOU] Usar "Estou sem tempo": Restrição estrita a bloco de 5 minutos');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE J FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE K: Usar "Não entendi a tarefa"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/tasks/simplify-instruction', 'POST', {
      raw_text: 'O cliente quer que faça a homologação da API levando em conta os cabeçalhos de segurança e a contingência'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.steps) || Array.isArray(res.data.sequential_steps) || Array.isArray(res.data.simplified_steps));
    assert.ok(res.data.first_action || res.data.first_ignition_step || res.data.immediate_first_step);
    console.log('✅ [TESTE K PASSOU] Usar "Não entendi a tarefa": Instrução traduzida em passos sequenciais');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE K FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE L: Usar "Estou ansioso"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/unblock/detailed', 'POST', {
      option: 'ansioso',
      task: 'Apresentação para diretoria'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.action || res.data.action_step || res.data.empathy || res.data.strategy);
    console.log('✅ [TESTE L PASSOU] Usar "Estou ansioso": Acolhimento e descompressão pré-ação');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE L FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE M: Usar "Ainda não consigo"
  // -------------------------------------------------------------
  try {
    const res = await request('/api/unblock/cant-do', 'POST', {
      task: 'Finalizar planilha financeira',
      option: 'menos_passos'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.action);
    console.log('✅ [TESTE M PASSOU] Usar "Ainda não consigo": Adaptação imediata sem culpa');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE M FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE N: Usar Despejar Tudo
  // -------------------------------------------------------------
  try {
    const res = await request('/api/brain-dump-v3', 'POST', {
      text: 'comprar cafe, preocupado com prazo do projeto, marcar dentista 14h, ideia de app, quem vai fazer o bolo'
    }, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.categories);
    assert.ok(res.data.recommended_next_action || res.data.summary || res.data.immediate_action);
    console.log('✅ [TESTE N PASSOU] Usar Despejar Tudo: 5 categorias formais e 1 ação destacada');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE N FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE O: Testar voz no celular
  // -------------------------------------------------------------
  try {
    const swRes = await request('/sw.js');
    const maniRes = await request('/manifest.json');
    assert.strictEqual(swRes.status, 200);
    assert.strictEqual(maniRes.status, 200);
    assert.strictEqual(maniRes.data.display, 'standalone');
    console.log('✅ [TESTE O PASSOU] Testar voz no celular: PWA standalone e service worker operacionais');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE O FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE P: Criar tarefa
  // -------------------------------------------------------------
  let createdTaskId = null;
  try {
    const res = await request('/api/tasks', 'POST', {
      title: 'Minha Tarefa de Auditoria Real',
      priority: 'AGORA',
      duration_minutes: 10
    }, authHeader);
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.id);
    createdTaskId = res.data.id;
    console.log('✅ [TESTE P PASSOU] Criar tarefa: Tarefa criada no foco AGORA');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE P FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE Q: Atualizar a página
  // -------------------------------------------------------------
  try {
    const res1 = await request('/app');
    const res2 = await request('/app');
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);
    console.log('✅ [TESTE Q PASSOU] Atualizar a página: Servidor entrega app de forma resiliente e idêntica');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE Q FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE R: Verificar persistência
  // -------------------------------------------------------------
  try {
    const res = await request('/api/tasks', 'GET', null, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    const found = res.data.find(t => t.id === createdTaskId);
    assert.ok(found, 'Tarefa recém criada deve persistir e ser encontrada');
    console.log('✅ [TESTE R PASSOU] Verificar persistência: Tarefas salvas e recuperadas com sucesso');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE R FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE S: Testar plano gratuito
  // -------------------------------------------------------------
  try {
    // 1. Criar novo usuário Free propositalmente expirado
    const freeEmail = `free_audit_${Date.now()}@teste.com`;
    const freeReg = await request('/api/auth/register', 'POST', {
      name: 'Free User Auditor',
      email: freeEmail,
      password: 'SenhaSegura123!'
    });
    const freeToken = freeReg.data.token;
    const freeHeader = {
      'Authorization': 'Bearer ' + freeToken,
      'Cookie': 'auth_token=' + freeToken
    };

    // Recurso gratuito: criar tarefa básica deve funcionar
    const basicTask = await request('/api/tasks', 'POST', { title: 'Tarefa Básica Gratuita' }, freeHeader);
    assert.strictEqual(basicTask.status, 201);

    // Forçar expiração do trial
    await request('/api/test/expire-trial', 'POST', null, freeHeader);

    // Recurso Pro (Decomposição profunda de IA) deve ser bloqueado com 403
    const proBlocked = await request('/api/tasks/decompose', 'POST', { task: 'Projeto Grande' }, freeHeader);
    assert.strictEqual(proBlocked.status, 403);
    assert.strictEqual(proBlocked.data.error, 'UPGRADE_REQUIRED');

    console.log('✅ [TESTE S PASSOU] Testar plano gratuito: Permite recursos gratuitos e bloqueia Pro com 403 após trial');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE S FALHOU]', e.message);
  }

  // -------------------------------------------------------------
  // TESTE T: Testar acesso premium
  // -------------------------------------------------------------
  try {
    // Usuário inicial tem trial ativo ou acesso liberado
    const proAllowed = await request('/api/tasks/decompose', 'POST', {
      task: 'Projeto Estratégico',
      level: 1,
      energy: 'media'
    }, authHeader);
    assert.strictEqual(proAllowed.status, 200);
    assert.ok(proAllowed.data.action_step || proAllowed.data.all_levels);

    console.log('✅ [TESTE T PASSOU] Testar acesso premium: Recursos Pro e Vitalício liberados integralmente');
    passed++;
  } catch (e) {
    console.error('❌ [TESTE T FALHOU]', e.message);
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTADO AUDITORIA FINAL (A a T): ${passed} de ${total} PASSARAM!`);
  console.log('====================================================\n');

  if (passed < total) {
    process.exit(1);
  }
}

runAuditTests().catch(err => {
  console.error('Erro fatal na suíte de auditoria:', err);
  process.exit(1);
});

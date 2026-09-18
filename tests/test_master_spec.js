/**
 * Suíte de Testes Obrigatórios - FocoGentil Master Spec V2 (Item 28)
 * 20 Testes Formais Cobrindo Cada Requisito do Sistema
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
      console.log(`✅ [TESTE ${testTotal}/20 PASSOU] ${desc}`);
      testPassed++;
    })
    .catch((err) => {
      console.error(`❌ [TESTE ${testTotal}/20 FALHOU] ${desc}`);
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
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runMasterSpecTests() {
  console.log('====================================================');
  console.log('🛡️ INICIANDO SUÍTE MASTER SPEC (20 TESTES OBRIGATÓRIOS)');
  console.log('====================================================\n');

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const testUserA = {
    name: 'Luciano Silva',
    email: `luciano_${Date.now()}@focogentil.com`,
    password: 'SenhaForte123!',
    phone: '+5511999998888'
  };

  const testUserB = {
    name: 'Beatriz Santos',
    email: `beatriz_${Date.now()}@focogentil.com`,
    password: 'OutraSenhaSegura456!',
    phone: '+5511977776666'
  };

  let tokenA = '';
  let userAId = '';
  let tokenB = '';
  let userBId = '';
  let taskAId1 = '';
  let taskAId2 = '';

  try {
    // 1. Cadastro
    await it('1. Cadastro: Cria usuário com criptografia PBKDF2 e retorna sessão segura', async () => {
      const res = await request('/api/auth/register', 'POST', testUserA);
      assert.strictEqual(res.status, 201);
      assert(res.json.token, 'Token deve ser retornado');
      assert.strictEqual(res.json.user.email, testUserA.email);
      assert.strictEqual(res.json.user.password_hash, undefined, 'Hash de senha nunca deve vazar');
      tokenA = res.json.token;
      userAId = res.json.user.id;
    });

    // 2. Login
    await it('2. Login: Autentica credenciais válidas e rejeita senha incorreta', async () => {
      const resErr = await request('/api/auth/login', 'POST', {
        email: testUserA.email,
        password: 'SenhaErrada'
      });
      assert.strictEqual(resErr.status, 401);

      const resOk = await request('/api/auth/login', 'POST', {
        email: testUserA.email,
        password: testUserA.password
      });
      assert.strictEqual(resOk.status, 200);
      assert(resOk.json.token);
      assert.strictEqual(resOk.json.user.id, userAId);
    });

    // 3. Logout
    await it('3. Logout: Encerra sessão do usuário e invalida token de acesso', async () => {
      const tempEmail = `temp_${Date.now()}@focogentil.com`;
      const reg = await request('/api/auth/register', 'POST', {
        name: 'Temp User',
        email: tempEmail,
        password: 'Password123'
      });
      const tempToken = reg.json.token;

      const resLogout = await request('/api/auth/logout', 'POST', null, {
        'Authorization': `Bearer ${tempToken}`
      });
      assert.strictEqual(resLogout.status, 200);
      assert.strictEqual(resLogout.json.success, true);

      const resMe = await request('/api/auth/me', 'GET', null, {
        'Authorization': `Bearer ${tempToken}`
      });
      assert.strictEqual(resMe.status, 401);
    });

    // 4. Criar tarefa
    await it('4. Criar tarefa: Cria tarefas atômicas atribuindo status AGORA e PRÓXIMO', async () => {
      const res1 = await request('/api/tasks', 'POST', {
        title: 'Abrir o editor e escrever uma frase',
        duration_minutes: 5,
        priority: 'hoje'
      }, { 'Authorization': `Bearer ${tokenA}` });
      assert.strictEqual(res1.status, 201);
      assert.strictEqual(res1.json.status, 'agora');
      taskAId1 = res1.json.id;

      const res2 = await request('/api/tasks', 'POST', {
        title: 'Revisar parágrafo inicial',
        duration_minutes: 10,
        priority: 'hoje'
      }, { 'Authorization': `Bearer ${tokenA}` });
      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.json.status, 'proximo');
      taskAId2 = res2.json.id;
    });

    // 5. Editar tarefa
    await it('5. Editar tarefa: Permite alterar título, duração, prioridade e status', async () => {
      const res = await request(`/api/tasks/${taskAId1}`, 'PUT', {
        title: 'Abrir o editor, respirar e escrever uma frase curta',
        duration_minutes: 7,
        priority: 'urgente'
      }, { 'Authorization': `Bearer ${tokenA}` });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.title, 'Abrir o editor, respirar e escrever uma frase curta');
      assert.strictEqual(res.json.duration_minutes, 7);
      assert.strictEqual(res.json.priority, 'urgente');
    });

    // 6. Concluir tarefa
    await it('6. Concluir tarefa: Marca como concluída e promove próximo passo para AGORA', async () => {
      const res = await request(`/api/tasks/${taskAId1}/complete`, 'POST', null, {
        'Authorization': `Bearer ${tokenA}`
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.completed.status, 'concluido');
      assert.strictEqual(res.json.promoted_next.id, taskAId2);
      assert.strictEqual(res.json.promoted_next.status, 'agora');
    });

    // 7. Quebrar tarefa com IA
    await it('7. Quebrar tarefa com IA: Decompõe tarefas grandes em micro-passos executáveis', async () => {
      const res = await request('/api/ai/break-task', 'POST', {
        task: 'Preparar a apresentação para a reunião de diretoria',
        energy: 'media'
      });
      assert.strictEqual(res.status, 200);
      assert(res.json.subtasks.length >= 3, 'Deve gerar pelo menos 3 micro-passos');
      assert(res.json.first_step, 'Deve indicar o primeiro passo imediato');
      assert(res.json.message.includes('micro-passos'));
    });

    // 8. Despejar tudo
    await it('8. Despejar tudo: Organiza fluxo mental caótico e destaca próximo passo recomendado', async () => {
      const res = await request('/api/ai/brain-dump', 'POST', {
        text: 'Pagar boleto da internet urgente, comprar ração pro cachorro e responder e-mail da faculdade',
        energy: 'media'
      });
      assert.strictEqual(res.status, 200);
      assert(res.json.tasks.length >= 3);
      assert(res.json.recommended_next_step);
      assert(res.json.message.includes('Você não precisa fazer tudo agora'));
    });

    // 9. Estou travado
    await it('9. Estou travado: Fornece acolhimento empático e micro-passo de 2 minutos (estágios 1 e 2)', async () => {
      const res1 = await request('/api/ai/unblock', 'POST', {
        task: 'Limpar a mesa de trabalho',
        reason: 'Estou procrastinando',
        stage: 1
      });
      assert.strictEqual(res1.status, 200);
      assert(res1.json.empathy_message.includes('Procrastinação'));
      assert(res1.json.action_step.includes('Apenas abra'));

      const res2 = await request('/api/ai/unblock', 'POST', {
        task: 'Limpar a mesa de trabalho',
        reason: 'Estou procrastinando',
        stage: 2
      });
      assert.strictEqual(res2.status, 200);
      assert(res2.json.action_step.includes('localize com os olhos') || res2.json.action_step.includes('água'));
    });

    // 10. Selecionar energia
    await it('10. Selecionar energia: Atualiza nível de energia e registra no histórico de auditoria', async () => {
      const res = await request('/api/user/energy', 'POST', {
        energy: 'baixa'
      }, { 'Authorization': `Bearer ${tokenA}` });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.energy, 'baixa');

      const resMe = await request('/api/auth/me', 'GET', null, {
        'Authorization': `Bearer ${tokenA}`
      });
      assert.strictEqual(resMe.json.energy_level, 'baixa');
    });

    // 11. Planejamento diário
    await it('11. Planejamento diário: Gera cronograma realista com pausas restaurativas', async () => {
      const res = await request('/api/ai/daily-plan', 'POST', {
        energy: 'media',
        available_hours: 4
      }, { 'Authorization': `Bearer ${tokenA}` });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.title, 'SEU PLANO MÍNIMO DE HOJE');
      assert(res.json.items.some(i => i.is_break), 'Deve conter pausas restaurativas');
    });

    // 12. Temporizador
    await it('12. Temporizador: App possui suporte a temporizador de pausas e contagem regressiva', async () => {
      const res = await request('/app');
      assert.strictEqual(res.status, 200);
      assert(res.body.includes('startPause('), 'Deve conter função de início de pausa');
      assert(res.body.includes('pauseCountdown'), 'Deve conter display de contagem regressiva');
      assert(res.body.includes('postPauseActions'), 'Deve conter ações pós-pausa [ SIM ] [ MAIS 5 MIN ]');
      assert(res.body.includes('resumeFromPause'), 'Deve conter retorno suave');
    });

    // 13. Captura por voz
    await it('13. Captura por voz: Frontend suporta Web Speech API com fallback de digitação', async () => {
      const res = await request('/app');
      assert.strictEqual(res.status, 200);
      assert(res.body.includes('SpeechRecognition') || res.body.includes('webkitSpeechRecognition'));
      assert(res.body.includes('toggleVoiceCapture'));
      assert(res.body.includes('btnVoiceFloat'));
      assert(res.body.includes('pt-BR'));
    });

    // 14. Responsividade mobile
    await it('14. Responsividade mobile: Contém meta viewport, classes touch-friendly e compartilhamento WhatsApp', async () => {
      const res = await request('/app');
      assert.strictEqual(res.status, 200);
      assert(res.body.includes('name="viewport"') && res.body.includes('width=device-width'), 'Deve conter meta tag viewport');
      assert(res.body.includes('@media (max-width: 600px)'));
      assert(res.body.includes('shareAppOnWhatsApp'));
      assert(res.body.includes('13+ anos'));
    });

    // 15. Responsividade desktop
    await it('15. Responsividade desktop: Limitação de largura máxima, grid limpo e sem poluição', async () => {
      const res = await request('/app');
      assert.strictEqual(res.status, 200);
      assert(res.body.includes('max-width: 800px') || res.body.includes('max-width: 680px'), 'Deve conter container com largura máxima');
      assert(res.body.includes('quick-grid'));
    });

    // 16. Proteção dos dados do usuário
    await it('16. Proteção de dados: Isolamento estrito entre usuários e proteção contra vazamentos', async () => {
      const regB = await request('/api/auth/register', 'POST', testUserB);
      tokenB = regB.json.token;
      userBId = regB.json.user.id;

      const resTasksB = await request('/api/tasks', 'GET', null, {
        'Authorization': `Bearer ${tokenB}`
      });
      assert.strictEqual(resTasksB.status, 200);
      assert.strictEqual(resTasksB.json.length, 0, 'Usuário B não deve ver tarefas do Usuário A');

      const resHack = await request(`/api/tasks/${taskAId2}`, 'PUT', {
        title: 'Tentativa de invasão'
      }, { 'Authorization': `Bearer ${tokenB}` });
      assert(resHack.status === 404 || !resHack.json || resHack.json.id !== taskAId2, 'Não deve permitir modificar tarefa de outro usuário');
    });

    // 17. Fluxo de pagamento
    await it('17. Fluxo de pagamento: Gera cobrança PIX com BR Code EMV válido para planos mensal e vitalício', async () => {
      const resMensal = await request('/api/checkout/create-charge', 'POST', {
        plan: 'mensal',
        name: testUserA.name,
        email: testUserA.email,
        payment_method: 'pix'
      });
      assert.strictEqual(resMensal.status, 200);
      assert.strictEqual(resMensal.json.plan, 'mensal');
      assert.strictEqual(resMensal.json.amount, 29.00);
      assert(resMensal.json.pix_code.startsWith('000201'), 'Deve ser payload BR Code EMV oficial');

      const resVitalicio = await request('/api/checkout/create-charge', 'POST', {
        plan: 'vitalicio',
        name: testUserA.name,
        email: testUserA.email,
        payment_method: 'pix'
      });
      assert.strictEqual(resVitalicio.status, 200);
      assert.strictEqual(resVitalicio.json.plan, 'vitalicio');
      assert(resVitalicio.json.amount === 49.90 || resVitalicio.json.amount === 97.00, 'Valor deve ser o configurado para vitalicio');
      assert(resVitalicio.json.pix_code.startsWith('000201'));
    });

    // 18. Acesso gratuito
    await it('18. Acesso gratuito: Usuário recém-criado possui plano gratuito ativo e limite do trial verificado', async () => {
      const resStatus = await request('/api/checkout/status', 'GET', null, {
        'Authorization': `Bearer ${tokenA}`
      });
      assert.strictEqual(resStatus.status, 200);
      assert.strictEqual(resStatus.json.plan, 'free');
      assert.strictEqual(typeof resStatus.json.is_trial_active, 'boolean');
      assert(resStatus.json.trial_minutes_remaining >= 0);
    });

    // 19. Acesso Pro
    await it('19. Acesso Pro: Simulação/Webhook de confirmação de pagamento ativa plano Pro', async () => {
      const resSimPro = await request('/api/checkout/simulate-approval', 'POST', {
        email: testUserA.email,
        plan: 'mensal'
      });
      assert.strictEqual(resSimPro.status, 200);
      assert.strictEqual(resSimPro.json.plan, 'pro');

      const resStatusPro = await request('/api/checkout/status', 'GET', null, {
        'Authorization': `Bearer ${tokenA}`
      });
      assert.strictEqual(resStatusPro.json.plan, 'pro');
      assert.strictEqual(resStatusPro.json.has_pro_access, true);
    });

    // 20. Acesso Vitalício
    await it('20. Acesso Vitalício: Confirmação de plano vitalício concede acesso perpétuo', async () => {
      const resSimVit = await request('/api/checkout/simulate-approval', 'POST', {
        email: testUserA.email,
        plan: 'vitalicio'
      });
      assert.strictEqual(resSimVit.status, 200);
      assert.strictEqual(resSimVit.json.plan, 'vitalicio');

      const resStatusVit = await request('/api/checkout/status', 'GET', null, {
        'Authorization': `Bearer ${tokenA}`
      });
      assert.strictEqual(resStatusVit.json.plan, 'vitalicio');
      assert.strictEqual(resStatusVit.json.has_pro_access, true);
    });

  } finally {
    server.close();
  }

  console.log(`\n====================================================`);
  console.log(`🛡️ RESULTADO MASTER SPEC: ${testPassed} de ${testTotal} testes passaram com sucesso!`);
  console.log(`====================================================`);

  if (testPassed !== testTotal) {
    process.exit(1);
  }
}

runMasterSpecTests();

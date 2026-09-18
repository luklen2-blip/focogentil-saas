/**
 * Suíte de Testes Automatizados - FocoGentil SaaS V2 Comercial
 * Valida todas as novas rotas de autenticação, tarefas, IA, planos e páginas.
 */

const http = require('http');
const assert = require('assert');
const { server } = require('../server');

const TEST_PORT = 3998;
let testPassed = 0;
let testTotal = 0;

function it(desc, fn) {
  testTotal++;
  return fn()
    .then(() => {
      console.log(`✅ [V2 PASSOU] ${desc}`);
      testPassed++;
    })
    .catch((err) => {
      console.error(`❌ [V2 FALHOU] ${desc}`);
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

async function runV2Tests() {
  console.log('====================================================');
  console.log('🧠 INICIANDO TESTES FOCOGENTIL SAAS V2 COMERCIAL');
  console.log('====================================================\n');

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const testEmail = `teste_${Date.now()}@focogentil.com`;
  const testPass = 'SenhaSegura123!';
  let authToken = '';
  let userId = '';
  let createdTaskId = '';

  try {
    // 1. Cadastro de Usuário
    await it('Cadastra novo usuário com senha criptografada e retorna token de sessão', async () => {
      const res = await request('/api/auth/register', 'POST', {
        name: 'Marina Foco',
        email: testEmail,
        password: testPass,
        phone: '+5511988887777'
      });
      assert.strictEqual(res.status, 201);
      assert(res.json.token, 'Deve retornar token de autenticação');
      assert.strictEqual(res.json.user.email, testEmail);
      assert.strictEqual(res.json.user.password_hash, undefined, 'Não deve expor hash da senha');
      authToken = res.json.token;
      userId = res.json.user.id;
    });

    // 2. Login com Senha Correta e Incorreta
    await it('Login rejeita senha incorreta e aprova senha correta', async () => {
      const resFail = await request('/api/auth/login', 'POST', {
        email: testEmail,
        password: 'SenhaErrada!'
      });
      assert.strictEqual(resFail.status, 401);

      const resSuccess = await request('/api/auth/login', 'POST', {
        email: testEmail,
        password: testPass
      });
      assert.strictEqual(resSuccess.status, 200);
      assert(resSuccess.json.token);
    });

    // 3. Validação de Sessão (/api/auth/me)
    await it('Endpoint /api/auth/me valida token Bearer e retorna dados do usuário autenticado', async () => {
      const res = await request('/api/auth/me', 'GET', null, {
        'Authorization': `Bearer ${authToken}`
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.email, testEmail);
    });

    // 4. Criação de Tarefas Estruturadas
    await it('Cria tarefas estruturadas: primeira vai para AGORA e segunda para PRÓXIMO', async () => {
      const res1 = await request('/api/tasks', 'POST', {
        title: 'Abrir planilha e respirar fundo',
        duration_minutes: 5,
        priority: 'hoje'
      }, { 'Authorization': `Bearer ${authToken}` });
      assert.strictEqual(res1.status, 201);
      assert.strictEqual(res1.json.status, 'agora');
      createdTaskId = res1.json.id;

      const res2 = await request('/api/tasks', 'POST', {
        title: 'Preencher primeira linha da planilha',
        duration_minutes: 10,
        priority: 'hoje'
      }, { 'Authorization': `Bearer ${authToken}` });
      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.json.status, 'proximo');
    });

    // 5. Conclusão de Tarefa e Promoção Automática
    await it('Conclui tarefa do AGORA e promove automaticamente o PRÓXIMO', async () => {
      const res = await request(`/api/tasks/${createdTaskId}/complete`, 'POST', null, {
        'Authorization': `Bearer ${authToken}`
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.completed.status, 'concluido');
      assert(res.json.promoted_next, 'Deve promover próxima tarefa');
      assert.strictEqual(res.json.promoted_next.status, 'agora');
    });

    // 6. Despejar Tudo (Brain Dump)
    await it('Despejar tudo categoriza fluxo de pensamentos e sugere apenas o próximo passo', async () => {
      const res = await request('/api/ai/brain-dump', 'POST', {
        text: 'Preciso pagar a conta de água urgente, responder o João e preparar o relatório de amanhã',
        energy: 'media'
      });
      assert.strictEqual(res.status, 200);
      assert(res.json.tasks.length >= 3);
      assert(res.json.recommended_next_step);
      assert(res.json.message.includes('Você não precisa fazer tudo agora'));
    });

    // 7. Modo Estou Travado (Redução Atômica)
    await it('Estou Travado acolhe o usuário e reduz a tarefa para o menor passo no estágio 1 e estágio 2', async () => {
      const res1 = await request('/api/ai/unblock', 'POST', {
        task: 'Fazer o relatório trimestral',
        reason: 'Não sei por onde começar',
        stage: 1
      });
      assert.strictEqual(res1.status, 200);
      assert(res1.json.action_step.includes('Apenas abra'));

      const res2 = await request('/api/ai/unblock', 'POST', {
        task: 'Fazer o relatório trimestral',
        reason: 'Não sei por onde começar',
        stage: 2
      });
      assert.strictEqual(res2.status, 200);
      assert(res2.json.action_step.includes('localize com os olhos') || res2.json.action_step.includes('água'));
    });

    // 8. Planejamento Automático do Dia
    await it('Gera plano mínimo diário realista baseado na energia do usuário', async () => {
      const res = await request('/api/ai/daily-plan', 'POST', {
        energy: 'baixa'
      }, { 'Authorization': `Bearer ${authToken}` });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.title, 'SEU PLANO MÍNIMO DE HOJE');
      assert(res.json.items.length > 0);
    });

    // 9. Atualização de Bateria Mental
    await it('Atualiza o nível de energia do usuário e registra no histórico', async () => {
      const res = await request('/api/user/energy', 'POST', {
        energy: 'alta'
      }, { 'Authorization': `Bearer ${authToken}` });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.energy, 'alta');
    });

    // 10. Métricas do Painel Administrativo
    await it('Painel Administrativo entrega métricas agregadas de usuários, tarefas e receita', async () => {
      const res = await request('/api/admin/metrics');
      assert.strictEqual(res.status, 200);
      assert(res.json.total_users >= 1);
      assert(res.json.total_tasks >= 1);
    });

    // 11. Páginas Estáticas e Roteamento V2
    await it('Servidor entrega todas as rotas limpas: Landing (/), App (/app), Admin (/admin), Simulador (/simulador), Termos (/termos) e Privacidade (/privacidade)', async () => {
      const rLanding = await request('/');
      assert.strictEqual(rLanding.status, 200);
      assert(rLanding.body.includes('FocoGentil'));

      const rApp = await request('/app');
      assert.strictEqual(rApp.status, 200);
      assert(rApp.body.includes('Como posso deixar seu dia mais leve?'));

      const rAdmin = await request('/admin');
      assert.strictEqual(rAdmin.status, 200);
      assert(rAdmin.body.includes('Painel'));

      const rSim = await request('/simulador');
      assert.strictEqual(rSim.status, 200);
      assert(rSim.body.includes('Simulador'));

      const rTermos = await request('/termos');
      assert.strictEqual(rTermos.status, 200);
      assert(rTermos.body.includes('Termos de Uso'));

      const rPriv = await request('/privacidade');
      assert.strictEqual(rPriv.status, 200);
      assert(rPriv.body.includes('LGPD'));
    });

    // 12. Ciclo de Vida de Pagamento Real (pending -> approved via admin/webhook)
    await it('Pagamento PIX é criado como pending e apenas approved libera a assinatura', async () => {
      const buyerPhone = '+5511977776666';
      // Criação do PIX
      const resCreate = await request('/api/pix/create', 'POST', {
        phone: buyerPhone,
        email: 'comprador@focogentil.com',
        name: 'Comprador Real',
        amount: 97.00,
        plan: 'vitalicio'
      });
      assert.strictEqual(resCreate.status, 200);
      assert.strictEqual(resCreate.json.status, 'pending');
      assert(resCreate.json.payment_id, 'Deve conter payment_id');
      const paymentId = resCreate.json.payment_id;

      // Consulta de status do pagamento
      const resStatus = await request(`/api/payments/status?id=${paymentId}`);
      assert.strictEqual(resStatus.status, 200);
      assert.strictEqual(resStatus.json.status, 'pending');
      assert.strictEqual(resStatus.json.approved, false);

      // Usuário comum não consegue autoaprovar o pagamento
      const resFakeConfirm = await request('/api/pix/confirm', 'POST', {
        payment_id: paymentId,
        phone: buyerPhone
      });
      assert.strictEqual(resFakeConfirm.status, 200);
      assert.strictEqual(resFakeConfirm.json.success, false);
      assert.strictEqual(resFakeConfirm.json.status, 'pending');

      // Admin aprova o pagamento após compensação bancária
      const resAdminApprove = await request('/api/admin/payments/update-status', 'POST', {
        payment_id: paymentId,
        status: 'approved'
      });
      assert.strictEqual(resAdminApprove.status, 200);
      assert.strictEqual(resAdminApprove.json.success, true);
      assert.strictEqual(resAdminApprove.json.payment.status, 'approved');

      // Checa se o status agora está approved
      const resStatusApproved = await request(`/api/payments/status?id=${paymentId}`);
      assert.strictEqual(resStatusApproved.status, 200);
      assert.strictEqual(resStatusApproved.json.status, 'approved');
      assert.strictEqual(resStatusApproved.json.approved, true);

      // Checa se o usuário teve o acesso vitalício liberado
      const resAuthCheck = await request(`/api/trial-status?phone=${encodeURIComponent(buyerPhone)}`);
      assert.strictEqual(resAuthCheck.status, 200);
      assert.strictEqual(resAuthCheck.json.is_lifetime, true);
    });

    // 13. Higienização das Telas do Usuário Final
    await it('Interfaces públicas (Landing Page e Checkout) não expõem links de simulador ou painel de cobrança admin', async () => {
      const rLanding = await request('/');
      assert(!rLanding.body.includes('/simulador.html'), 'Landing page não deve conter link para simulador de teste');
      assert(!rLanding.body.includes('/admin'), 'Landing page não deve conter link para painel admin');

      const rCheckout = await request('/checkout.html');
      assert(!rCheckout.body.includes('/simulador.html'), 'Checkout não deve conter link para simulador');
      assert(!rCheckout.body.includes('Painel de Cobrança:'), 'Checkout não deve expor painel de cobrança');
      assert(!rCheckout.body.includes('admin-bar'), 'Checkout não deve conter barra administrativa');
    });

  } finally {
    server.close();
  }

  console.log(`\n====================================================`);
  console.log(`RESULTADO V2: ${testPassed} de ${testTotal} testes passaram com sucesso! 🚀`);
  console.log(`====================================================`);

  if (testPassed !== testTotal) {
    process.exit(1);
  }
}

runV2Tests();

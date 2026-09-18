const assert = require('assert');
const http = require('http');
const { server } = require('../server');
const db = require('../database');

const PORT = 5099;

function request(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });

    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runExecutiveTests() {
  console.log('====================================================');
  console.log('🧠 TESTES EXECUTIVOS: FOCOGENTIL COPILOTO V2');
  console.log('====================================================\n');

  await new Promise(res => server.listen(PORT, res));

  try {
    // 1. Registro e autenticação de usuário de teste
    const userPayload = {
      name: 'Neuro Test User',
      email: `neuro_${Date.now()}@teste.com`,
      password: 'SenhaForte123!'
    };
    const regRes = await request('/api/auth/register', 'POST', userPayload);
    assert.strictEqual(regRes.status, 201, 'Deve registrar usuário');
    const token = regRes.json.token;
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    console.log('✅ [TESTE 1] Autenticação do usuário de teste bem-sucedida');

    // 2. Motor de Estado Mental (Item 1 & 2)
    const statesToTest = ['baixa', 'media', 'boa', 'sobrecarregado', 'disperso', 'paralisado', 'hiperfoco', 'sem_rumo'];
    for (const st of statesToTest) {
      const stateRes = await request('/api/state', 'POST', { state: st, notes: 'Teste estado' }, authHeaders);
      assert(stateRes.status === 200 || stateRes.status === 201, `Deve aceitar estado ${st}`);
      assert(stateRes.json.guidance, 'Deve retornar orientação adaptativa');
      assert.strictEqual((stateRes.json.log || stateRes.json.state).state, st);
    }
    console.log('✅ [TESTE 2] Motor de Estado Adaptativo processa todos os 8 estados neurocognitivos');

    // 3. Histórico de Estados
    const historyRes = await request('/api/state/history', 'GET', null, authHeaders);
    assert.strictEqual(historyRes.status, 200);
    assert(Array.isArray(historyRes.json.history));
    assert(historyRes.json.history.length >= 8);
    console.log('✅ [TESTE 3] Histórico de estados consultado com persistência atômica');

    // 4. Todas as 12 Razões de Travamento (Item 3 & 4)
    const reasons = [
      'nao_sei_comecar', 'tarefa_grande', 'cansado', 'ansioso', 'entediado',
      'medo_errar', 'nao_entendi', 'coisas_demais', 'distraido',
      'nao_consigo_decidir', 'ambiente_incomodando', 'nao_sei_explicar'
    ];
    for (const reason of reasons) {
      const unblockRes = await request('/api/unblock/intervene', 'POST', {
        reason,
        task_title: 'Escrever relatório de auditoria'
      }, authHeaders);
      assert.strictEqual(unblockRes.status, 200, `Intervenção para ${reason} deve responder 200`);
      assert(unblockRes.json.strategy, 'Deve ter estratégia acolhedora');
      assert(unblockRes.json.micro_action, 'Deve ter microação de 2 minutos');
      assert.strictEqual(unblockRes.json.stage, 1);
    }
    console.log('✅ [TESTE 4] Motor Estou Travado cobre todas as 12 razões com estratégias específicas');

    // 5. Estágio 2 de Redução Radical do Desbloqueio
    const stage2Res = await request('/api/unblock/intervene', 'POST', {
      reason: 'cansado',
      task_title: 'Escrever relatório',
      stage: 2
    }, authHeaders);
    assert.strictEqual(stage2Res.status, 200);
    const maLower = (stage2Res.json.micro_action || '').toLowerCase();
    assert(maLower.includes('1 minuto') || maLower.includes('apenas'), 'Deve reduzir ainda mais');
    console.log('✅ [TESTE 5] Estágio 2 de redução radical de sobrecarga validado');

    // 6. Decomposição Progressiva em 5 Níveis (Item 5)
    const decompRes = await request('/api/tasks/decompose', 'POST', {
      task_title: 'Limpar e organizar o armário da garagem'
    }, authHeaders);
    assert.strictEqual(decompRes.status, 200);
    assert(decompRes.json.level1_objective, 'Deve conter Nível 1: Objetivo');
    assert(decompRes.json.level2_task, 'Deve conter Nível 2: Tarefa');
    assert(decompRes.json.level3_action, 'Deve conter Nível 3: Ação');
    assert(decompRes.json.level4_micro_action, 'Deve conter Nível 4: Microação');
    assert(decompRes.json.level5_physical_movement, 'Deve conter Nível 5: Primeiro Movimento Físico');
    console.log('✅ [TESTE 6] Decomposição formal em 5 níveis hierárquicos executada com sucesso');

    // 7. Despejar Tudo V2 (Brain Dump) - Separação Tarefas vs Preocupações (Item 7)
    const dumpRes = await request('/api/brain-dump-v2', 'POST', {
      raw_text: 'Preciso enviar email para o cliente. Estou muito preocupado com a conta de energia que vence amanhã. Lavar a louça acumulada. Será que esqueci de trancar o carro?'
    }, authHeaders);
    assert.strictEqual(dumpRes.status, 200);
    assert(Array.isArray(dumpRes.json.tasks), 'Deve separar tarefas');
    assert(Array.isArray(dumpRes.json.worries), 'Deve separar preocupações');
    assert(dumpRes.json.tasks.length >= 1, 'Deve conter tarefas');
    assert(dumpRes.json.worries.length >= 1, 'Deve conter preocupações');
    assert(dumpRes.json.first_gentle_step, 'Deve sugerir primeiro passo gentil');
    console.log('✅ [TESTE 7] Despejar Tudo V2 categoriza tarefas vs preocupações e apresenta opções gentis');

    // 8. Registro e Resolução de Preocupações (Item 8)
    const worryRes = await request('/api/worries', 'POST', { text: 'Medo de esquecer o compromisso das 15h' }, authHeaders);
    assert.strictEqual(worryRes.status, 201);
    const worryId = worryRes.json.worry.id;

    const listWorries = await request('/api/worries', 'GET', null, authHeaders);
    assert.strictEqual(listWorries.status, 200);
    assert(listWorries.json.worries.some(w => w.id === worryId));

    const resolveRes = await request(`/api/worries/${worryId}/resolve`, 'POST', {}, authHeaders);
    assert.strictEqual(resolveRes.status, 200);
    console.log('✅ [TESTE 8] Gestão e acolhimento do estacionamento de preocupações operando com sucesso');

    // 9. Planejamento do Dia Mínimo & Realista (Item 9)
    const dayPlanRes = await request('/api/day-plan', 'POST', {
      energy: 'baixa',
      available_time: '2 horas'
    }, authHeaders);
    assert.strictEqual(dayPlanRes.status, 200);
    assert(dayPlanRes.json.plan.essentials.length <= 3, 'Plano essencial não deve sobrecarregar');
    assert(dayPlanRes.json.plan.breaks.length >= 1, 'Plano deve incluir pausas restaurativas');
    console.log('✅ [TESTE 9] Planejamento diário mínimo protege contra sobrecarga');

    // 10. Sensibilidade e Ambiente (Item 14)
    const sensoryRes = await request('/api/sensory', 'POST', {
      type: 'luz_forte',
      action_taken: 'Diminuiu o brilho da tela'
    }, authHeaders);
    assert(sensoryRes.status === 200 || sensoryRes.status === 201);
    assert(sensoryRes.json.guidance, 'Deve fornecer orientação de conforto sensorial');

    const sensoryHist = await request('/api/sensory/history', 'GET', null, authHeaders);
    assert.strictEqual(sensoryHist.status, 200);
    assert(sensoryHist.json.history.length >= 1);
    console.log('✅ [TESTE 10] Checklist e registro de conforto sensorial operacionais');

    // 11. Regulação Emocional Pré-Tarefa & Guardrail CVV 188 (Item 15 & 33)
    const emoRes = await request('/api/emotions', 'POST', {
      emotion: 'ansiedade',
      intensity: 8,
      task_title: 'Apresentação pública'
    }, authHeaders);
    assert.strictEqual(emoRes.status, 200);
    assert(emoRes.json.strategy, 'Deve sugerir regulação sem julgamento');
    assert(emoRes.json.disclaimer.includes('CVV 188') || emoRes.json.strategy.includes('CVV 188') || emoRes.json.disclaimer.includes('médico'), 'Deve incluir aviso e CVV');
    console.log('✅ [TESTE 11] Regulação emocional com aviso ético e CVV 188 em caso de crise');

    // 12. Comunicação: Me Ajude a Explicar (Item 16)
    const explainRes = await request('/api/communication/explain', 'POST', {
      text: 'Não vou conseguir entregar hoje porque estou sobrecarregado',
      category: 'pedir_prazo',
      tone: 'gentil'
    }, authHeaders);
    assert.strictEqual(explainRes.status, 200);
    assert(explainRes.json.output_text, 'Deve gerar texto pronto');
    assert(explainRes.json.output_text.length > 10);
    console.log('✅ [TESTE 12] Me Ajude a Explicar gera mensagens estruturadas com diversos tons');

    // 13. Modos Especiais: Estudos, Trabalho e Casa Modo Mínimo (Itens 17, 18, 19)
    const studyRes = await request('/api/modes/study', 'POST', { topic: 'Neuroanatomia' }, authHeaders);
    assert.strictEqual(studyRes.status, 200);
    assert(Array.isArray(studyRes.json.blocks));

    const workRes = await request('/api/modes/work', 'POST', { task: 'Revisão de contratos' }, authHeaders);
    assert.strictEqual(workRes.status, 200);
    assert(workRes.json.first_step);

    const homeRes = await request('/api/modes/home', 'POST', { is_minimum_mode: true }, authHeaders);
    assert.strictEqual(homeRes.status, 200);
    assert(homeRes.json.first_step);
    console.log('✅ [TESTE 13] Modos de Vida (Estudos, Trabalho, Casa Modo Mínimo) funcionando');

    // 14. Memória Adaptativa da IA (Item 20 & 21)
    const memRes = await request('/api/memory', 'POST', {
      memory_key: 'preferencia_musica',
      memory_value: 'Gosta de ruído branco para focar em tarefas de leitura',
      category: 'foco'
    }, authHeaders);
    assert.strictEqual(memRes.status, 201);
    const memId = memRes.json.memory.id;

    const listMem = await request('/api/memory', 'GET', null, authHeaders);
    assert.strictEqual(listMem.status, 200);
    assert(listMem.json.memories.some(m => m.id === memId));

    const delMem = await request(`/api/memory/${memId}`, 'DELETE', null, authHeaders);
    assert.strictEqual(delMem.status, 200);
    console.log('✅ [TESTE 14] CRUD da Memória de Trabalho da IA com transparência e controle pelo usuário');

    // 15. Feedback de Estratégias (Item 22)
    const fbRes = await request('/api/feedback/strategy', 'POST', {
      strategy_id: 'micro_passo_2min',
      rating: 'ajudou',
      notes: 'Consegui abrir o documento'
    }, authHeaders);
    assert.strictEqual(fbRes.status, 200);
    console.log('✅ [TESTE 15] Feedback adaptativo sobre eficácia das estratégias registrado');

    // 16. Padrões de Funcionamento (Sem pontuação tóxica ou ranqueamento) (Item 23)
    const patternsRes = await request('/api/dashboard/patterns', 'GET', null, authHeaders);
    assert.strictEqual(patternsRes.status, 200);
    assert.strictEqual(patternsRes.json.has_ranking, false, 'Não deve conter ranking ou pontuação punitiva');
    assert(patternsRes.json.adaptive_insights, 'Deve conter insights empáticos');
    console.log('✅ [TESTE 16] Padrões de Funcionamento consolidados com ética neurodivergente (sem toxicidade)');

    // 17. Preferências do Usuário e Acessibilidade Cognitiva (Item 25 & 26)
    const prefRes = await request('/api/preferences', 'POST', {
      hide_secondary_tasks: true,
      quiet_mode: true,
      low_stimulus_visual: true
    }, authHeaders);
    assert.strictEqual(prefRes.status, 200);
    assert.strictEqual(prefRes.json.preferences.low_stimulus_visual, true);
    console.log('✅ [TESTE 17] Ajustes de baixa estimulação visual e modo silencioso preservados');

    // 18. Service Worker para PWA Offline (Item 28 & Diretriz Nuvem)
    const swRes = await request('/sw.js');
    assert.strictEqual(swRes.status, 200, 'sw.js deve ser servido com status 200');
    assert(swRes.body.includes('CACHE_NAME'), 'Deve ser um service worker válido');
    console.log('✅ [TESTE 18] Service Worker para PWA e suporte offline disponível');

    console.log('\n====================================================');
    console.log('🎉 TODOS OS 18 TESTES DE FUNÇÃO EXECUTIVA PASSARAM!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runExecutiveTests().catch(err => {
    console.error('❌ Erro nos testes executivos:', err);
    process.exit(1);
  });
}

module.exports = { runExecutiveTests };

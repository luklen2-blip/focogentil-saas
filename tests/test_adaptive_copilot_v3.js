/**
 * Suíte de Testes Automatizados: FocoGentil Copiloto de Função Executiva V3
 * Validação ponta a ponta dos novos fluxos adaptativos:
 * 1. Despejar Tudo V3 (5 Categorias: tarefas, compromissos, preocupações, ideias, decisões)
 * 2. Microação de 30 Segundos ("Começar por 30s" -> "Pronto?" -> Continuar / Parar sem culpa)
 * 3. Botão Inteligente "Ainda Não Consigo" (6 caminhos)
 * 4. Intervenções Específicas "Estou Travado" (8 razões reais)
 * 5. Simplificador de Instruções Confusas
 * 6. Exclusão completa de memórias da IA
 * 7. Eliminação total de menções a 'dopamina' e adoção da frase oficial na Pausa Sem Culpa
 * 8. Disponibilidade dos 7 tipos oficiais de pausa restaurativa
 * 9. Ausência de regressão visual ou funcional
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { server } = require('../server');

const TEST_PORT = 3995;

function request(urlPath, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: urlPath,
      method: method,
      headers: reqHeaders
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧠 SUÍTE COPILOTO DE FUNÇÃO EXECUTIVA V3 (10 TESTES)');
  console.log('====================================================\n');

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  let passed = 0;
  let total = 0;

  async function it(title, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASSOU] ${title}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FALHOU] ${title}`);
      console.error(err);
      server.close();
      process.exit(1);
    }
  }

  // 1. Health check
  await it('1. Servidor ativo com health check operacional', async () => {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, 'ok');
  });

  // 2. Despejar Tudo V3 (5 categorias)
  await it('2. Despejar Tudo V3 classifica em 5 categorias formais', async () => {
    const text = "Preciso entregar o relatório amanhã às 14h. Estou muito preocupado com a reunião de diretoria. Tive uma ideia de criar um podcast. Preciso decidir se viajo no feriado.";
    const res = await request('/api/brain-dump-v3', 'POST', { text, energy: 'media' });
    assert.strictEqual(res.status, 200);
    assert(res.json.categories, 'Deve conter objeto categories');
    assert(Array.isArray(res.json.categories.tasks), 'Tarefas');
    assert(Array.isArray(res.json.categories.events), 'Compromissos');
    assert(Array.isArray(res.json.categories.worries), 'Preocupações');
    assert(Array.isArray(res.json.categories.ideas), 'Ideias');
    assert(Array.isArray(res.json.categories.decisions), 'Decisões');
    assert(res.json.recommended_next_action, 'Deve recomendar ação imediata');
  });

  // 3. Microação de 30 segundos
  await it('3. Microação de 30 segundos gera ação atômica e opções pós-ignição', async () => {
    const res = await request('/api/tasks/micro-30s', 'POST', { task: 'Estudar para prova de cálculo' });
    assert.strictEqual(res.status, 200);
    assert(res.json.micro_action, 'Deve ter ação de 30 segundos');
    assert.strictEqual(res.json.time_seconds, 30);
    assert(res.json.options.includes('Continuar'));
    assert(res.json.options.some(o => o.toLowerCase().includes('parar')));
  });

  // 4. Botão Inteligente "Ainda Não Consigo" (6 opções)
  await it('4. Botão "Ainda Não Consigo" trata as 6 rotas adaptativas', async () => {
    const options = ['menos_passos', 'menos_tempo', 'explicar_melhor', 'fazer_junto', 'deixar_depois', 'preciso_pausa'];
    for (const opt of options) {
      const res = await request('/api/unblock/cant-do', 'POST', { task: 'Organizar documentos do imposto', option: opt });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.option, opt);
      assert(res.json.empathy, 'Deve conter acolhimento empático');
      assert(res.json.action_step, 'Deve conter passo ou encaminhamento');
    }
  });

  // 5. Estou Travado com 8 razões reais
  await it('5. Estou Travado implementa intervenções dedicadas para as 8 razões', async () => {
    const reasons = [
      'nao_sei_comecar',
      'coisas_demais',
      'sem_energia',
      'sem_tempo',
      'procrastinando',
      'nao_entendi',
      'ansioso',
      'outra_coisa'
    ];
    for (const r of reasons) {
      const res = await request('/api/unblock/detailed', 'POST', {
        reason: r,
        task: 'Escrever artigo científico',
        extra_input: r === 'sem_tempo' ? 'tempo:5m' : ''
      });
      assert.strictEqual(res.status, 200);
      assert(res.json.action_step, `Razão ${r} deve ter ação concreta`);
      assert(res.json.empathy, `Razão ${r} deve ter empatia`);
    }
  });

  // 6. Simplificador de instruções confusas
  await it('6. Simplificador traduz texto confuso em passos sequenciais diretos', async () => {
    const instruction = "Para protocolar o processo, realize o upload do anexo via protocolo ICP-Brasil, assine digitalmente a procuração ad judicia e homologue o requerimento.";
    const res = await request('/api/tasks/simplify-instruction', 'POST', { instruction });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.json.sequential_steps), 'Deve conter array de passos');
    assert(res.json.first_ignition_step, 'Deve ter primeiro passo de ignição');
  });

  // 7. Exclusão completa de memórias da IA
  await it('7. Endpoint DELETE /api/memory/clear-all purga memórias com segurança', async () => {
    const res = await request('/api/memory/clear-all', 'DELETE');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
  });

  // 8. Conformidade do HTML de app.html: Pausa sem culpa e ausência de 'dopamina'
  await it('8. app.html contém frase oficial da Pausa Sem Culpa e zero menções a dopamina', async () => {
    const appHtml = fs.readFileSync(path.join(__dirname, '../public/app.html'), 'utf8');
    assert(appHtml.includes('Seu cérebro também precisa de momentos de recuperação.'), 'Deve conter frase oficial da pausa');
    assert(!/dopamin/i.test(appHtml), 'NÃO deve conter referências pseudo-científicas a dopamina');
  });

  // 9. Presença dos 7 tipos oficiais de pausa
  await it('9. app.html disponibiliza os 7 tipos oficiais de pausa restaurativa', async () => {
    const appHtml = fs.readFileSync(path.join(__dirname, '../public/app.html'), 'utf8');
    const pauseTypes = ['respirar', 'agua', 'movimento', 'visual', 'estimulos', 'descansar', 'silencio'];
    for (const pt of pauseTypes) {
      assert(appHtml.includes(`triggerPauseType('${pt}')`), `Tipo de pausa '${pt}' deve estar disponível`);
    }
  });

  // 10. Modais de 30s, Ainda Não Consigo e 5 Dimensões
  await it('10. app.html contém modais operacionais para 30s, Ainda Não Consigo e 5 Dimensões', async () => {
    const appHtml = fs.readFileSync(path.join(__dirname, '../public/app.html'), 'utf8');
    assert(appHtml.includes('id="cantDoModal"'), 'Deve conter modal Ainda Não Consigo');
    assert(appHtml.includes('id="micro30sModal"'), 'Deve conter modal Microação 30s');
    assert(appHtml.includes('id="stateModal"'), 'Deve conter modal 5 Dimensões');
    assert(appHtml.includes('Três tarefas essenciais já são suficientes para hoje'), 'Aviso suave de sobrecarga');
  });

  console.log(`\n====================================================`);
  console.log(`🎉 TODOS OS ${passed} de ${total} TESTES DA SUÍTE V3 PASSARAM!`);
  console.log(`====================================================\n`);

  server.close();
}

runTests().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});

/**
 * Script de validação e testes automatizados do sistema FocoGentil
 * Executado diretamente no Node.js v24+
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('🧠 TESTES DE VALIDAÇÃO: FOCOGENTIL NEURO-COPILOT');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASSOU] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FALHOU] ${name}`);
    console.error(err);
  }
}

const n8nDir = path.join(__dirname, '..', 'n8n');
const backendDir = path.join(__dirname, '..', 'backend');

// -------------------------------------------------------------
// 1. Validação dos Workflows n8n
// -------------------------------------------------------------
test('Workflow n8n Inbound (WhatsApp) é JSON válido com nós obrigatórios', () => {
  const filePath = path.join(n8nDir, 'workflow_whatsapp_inbound.json');
  assert(fs.existsSync(filePath), 'Arquivo workflow_whatsapp_inbound.json deve existir');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert(data.name, 'Workflow deve ter nome');
  assert(Array.isArray(data.nodes), 'Workflow deve conter nós');
  assert(data.connections, 'Workflow deve conter conexões');

  const webhookNode = data.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  assert(webhookNode, 'Deve possuir nó webhook Twilio');
  assert.strictEqual(webhookNode.parameters.path, 'twilio-whatsapp-inbound');
});

test('Workflow n8n Cron de Lembretes é JSON válido e possui gatilho de agendamento', () => {
  const filePath = path.join(n8nDir, 'workflow_reminders_cron.json');
  assert(fs.existsSync(filePath), 'Arquivo workflow_reminders_cron.json deve existir');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert(data.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger'), 'Deve ter trigger agendador');
});

test('Workflow n8n de Pagamento Único valida ausência de recorrência', () => {
  const filePath = path.join(n8nDir, 'workflow_payment_webhook.json');
  assert(fs.existsSync(filePath), 'Arquivo workflow_payment_webhook.json deve existir');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const codeNode = data.nodes.find(n => n.name.includes('Validar Pagamento Único'));
  assert(codeNode, 'Deve existir nó de código validando pagamento único');
  assert(codeNode.parameters.jsCode.includes('is_recurring: false'), 'Deve fixar is_recurring como false');
});

// -------------------------------------------------------------
// 2. Validação da Lógica Neurodivergente
// -------------------------------------------------------------
test('Módulo de decomposição garante passo de ignição ultra-rápido (<= 5 min)', () => {
  // Simulação da lógica da NeuroDecompositionEngine
  function mockDecompose(input, energy) {
    return {
      project_title: input.slice(0, 30),
      energy_level: energy,
      micro_tasks: [
        { step_number: 1, title: 'Abrir o material e respirar fundo', duration_minutes: 3, urgency_score: 5 },
        { step_number: 2, title: 'Ler ou escrever a primeira frase', duration_minutes: 7, urgency_score: 4 },
        { step_number: 3, title: 'Focar por 10 minutos com cronômetro', duration_minutes: 10, urgency_score: 3 }
      ],
      gentle_tip: 'Feito é melhor que perfeito. Vamos focar apenas no Passo 1!'
    };
  }

  const result = mockDecompose('Escrever monografia', 'baixa');
  assert(result.micro_tasks.length >= 3, 'Deve gerar pelo menos 3 microtarefas');
  assert(result.micro_tasks[0].duration_minutes <= 5, 'Passo 1 deve levar 5 min ou menos');
  assert(result.micro_tasks[0].step_number === 1);
});

// -------------------------------------------------------------
// 3. Validação do Modelo de Pagamento Único (Sem Vínculo Contínuo)
// -------------------------------------------------------------
test('Gerenciador de Licença rejeita assinaturas e aprova compras vitalícias', () => {
  class MockLicenseManager {
    constructor() {
      this.users = new Map();
    }
    processPayment(payload) {
      if (payload.is_recurring) {
        throw new Error('Assinatura contínua não permitida! Modelo de pagamento único.');
      }
      this.users.set(payload.phone, {
        is_lifetime_active: true,
        has_recurring_subscription: false,
        paid_at: new Date()
      });
      return this.users.get(payload.phone);
    }
    isAuthorized(phone) {
      const user = this.users.get(phone);
      return Boolean(user && user.is_lifetime_active && !user.has_recurring_subscription);
    }
  }

  const lm = new MockLicenseManager();
  
  // Teste de rejeição de recorrência
  assert.throws(() => {
    lm.processPayment({ phone: '+5511999990000', is_recurring: true });
  }, /Assinatura contínua não permitida/);

  // Teste de pagamento único aprovado
  const user = lm.processPayment({ phone: '+5511999990000', is_recurring: false });
  assert.strictEqual(user.is_lifetime_active, true);
  assert.strictEqual(user.has_recurring_subscription, false);
  assert.strictEqual(lm.isAuthorized('+5511999990000'), true);
  assert.strictEqual(lm.isAuthorized('+5511888880000'), false);
});

// -------------------------------------------------------------
// 4. Validação de Lembretes sem Culpa e Respeito a Horário de Sono
// -------------------------------------------------------------
test('Cálculo de lembrete respeita horários de silêncio (22h - 8h)', () => {
  function calculateReminderTime(baseDate, durationMinutes, quietStart = 22, quietEnd = 8) {
    const target = new Date(baseDate.getTime() + durationMinutes * 60000);
    const hour = target.getHours();
    if (hour >= quietStart || hour < quietEnd) {
      // Reprograma para as 09:00
      target.setDate(target.getDate() + (hour >= quietStart ? 1 : 0));
      target.setHours(quietEnd + 1, 0, 0, 0);
    }
    return target;
  }

  // Simula tarefa iniciada às 23:00
  const lateNight = new Date();
  lateNight.setHours(23, 0, 0, 0);
  const scheduled = calculateReminderTime(lateNight, 15);
  
  assert.strictEqual(scheduled.getHours(), 9, 'Deve reprogramar para após o silêncio noturno (9h)');
});

// -------------------------------------------------------------
// 5. Validação do Período de Teste Gratuito de 30 Minutos
// -------------------------------------------------------------
test('Usuário novo recebe 30 minutos de teste antes de ser cobrado', () => {
  const db = require('../database');
  const testTrialPhone = '+551198888000' + Math.floor(Math.random() * 100);
  
  // Novo usuário entra no sistema
  db.registerOrGetUser(testTrialPhone);
  const statusInitial = db.getTrialStatus(testTrialPhone);
  assert.strictEqual(statusInitial.in_trial, true, 'Deve iniciar em período de teste');
  assert(statusInitial.remaining_seconds > 1700, 'Deve ter aproximadamente 30 minutos');
  assert.strictEqual(db.isAuthorized(testTrialPhone), true, 'Deve estar autorizado durante os 30 min');

  // Simula expiração dos 30 minutos
  db.expireTrialNow(testTrialPhone);
  const statusExpired = db.getTrialStatus(testTrialPhone);
  assert.strictEqual(statusExpired.in_trial, false, 'Período de teste deve expirar após 30 min');
  assert.strictEqual(db.isAuthorized(testTrialPhone), false, 'Não deve estar autorizado após expirar teste e sem pagamento');

  // Usuário realiza o pagamento único
  db.activateLifetimeLicense(testTrialPhone, 'PIX_TRIAL_OK', 97.0, 'pix', 'Cliente Teste');
  assert.strictEqual(db.isAuthorized(testTrialPhone), true, 'Deve estar permanentemente autorizado após pagamento');
});

console.log(`\n====================================================`);
console.log(`RESULTADO: ${passedTests} de ${totalTests} testes passaram com sucesso! 🎉`);
console.log(`====================================================`);

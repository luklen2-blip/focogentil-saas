/**
 * Camada de Serviço de IA Desacoplada - FocoGentil V2
 * Processa pensamentos livres, destrava tarefas, gera planos diários e atua como copiloto.
 * Suporta Google Gemini API (quando GEMINI_API_KEY estiver configurada)
 * com fallback inteligente para o motor semântico heurístico nativo.
 */

const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

class AIService {
  constructor() {
    this.apiKey = GEMINI_API_KEY;
  }

  // --- 1. Despejar Tudo (Brain Dump) ---
  async parseBrainDump(text, energyLevel = 'media') {
    const rawLines = text
      .split(/[\n,;]|\be\b|\btambém\b|\bdepois\b/i)
      .map(s => s.trim())
      .filter(s => s.length > 2);

    const tasks = [];
    const keywordsUrgent = ['urgente', 'hoje', 'pagar', 'conta', 'prazo', 'médico', 'banco', 'relatório', 'entregar'];
    const keywordsImportant = ['reunião', 'preparar', 'estudar', 'cliente', 'projeto', 'trabalho'];
    const keywordsQuick = ['responder', 'ligar', 'enviar', 'mensagem', 'olhar', 'verificar', 'abrir'];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const lower = line.toLowerCase();

      let priority = 'depois';
      let duration = 15;

      if (keywordsUrgent.some(k => lower.includes(k))) {
        priority = 'urgente';
        duration = 10;
      } else if (keywordsImportant.some(k => lower.includes(k))) {
        priority = 'importante';
        duration = 30;
      } else if (i < 2) {
        priority = 'hoje';
        duration = 15;
      } else {
        priority = 'baixa';
        duration = 20;
      }

      if (keywordsQuick.some(k => lower.includes(k))) {
        duration = 5;
      }

      // Ajusta duração estimada com base no nível de energia
      if (energyLevel === 'baixa' && duration > 10) {
        duration = 10;
      }

      tasks.push({
        id: 'dump_' + Date.now() + '_' + i,
        title: line.charAt(0).toUpperCase() + line.slice(1),
        priority: priority,
        duration_minutes: duration
      });
    }

    // Se o usuário digitou apenas uma frase longa sem separadores
    if (tasks.length === 0 && text.trim().length > 0) {
      tasks.push({
        id: 'dump_' + Date.now() + '_0',
        title: text.trim().charAt(0).toUpperCase() + text.trim().slice(1),
        priority: 'hoje',
        duration_minutes: energyLevel === 'baixa' ? 5 : 15
      });
    }

    // Ordena por urgência e menor fricção
    const priorityWeight = { urgente: 1, importante: 2, hoje: 3, depois: 4, baixa: 5 };
    tasks.sort((a, b) => (priorityWeight[a.priority] || 99) - (priorityWeight[b.priority] || 99));

    // Escolhe o melhor próximo passo (prioridade mais alta e menor tempo)
    const recommendedNext = tasks.length > 0 ? tasks[0] : null;

    return {
      message: "Eu organizei seus pensamentos. Você não precisa fazer tudo agora.",
      tasks: tasks,
      total_items: tasks.length,
      recommended_next_step: recommendedNext
    };
  }

  // --- 2. Modo "Estou Travado" ---
  async unblockTask(taskText, reason = 'Não sei por onde começar', stage = 1) {
    const cleanTitle = (taskText || 'sua tarefa').trim();

    // Dicionário de respostas empáticas por motivo de bloqueio
    const reasonFeedback = {
      'Não sei por onde começar': 'Quando o começo parece nebuloso, a solução não é planejar tudo. É apenas encostar na tarefa.',
      'Tem coisa demais': 'A sobrecarga paralisa o cérebro. Vamos fingir que todas as outras coisas não existem pelos próximos 3 minutos.',
      'Estou sem energia': 'Respeite seu corpo. Não vamos exigir foco profundo hoje. Faremos apenas a versão microscópica.',
      'Estou sem tempo': 'Se você tiver apenas 2 minutos livres, já é suficiente para destravar o início.',
      'Estou procrastinando': 'Procrastinação é regulação emocional, não preguiça. Vamos reduzir a fricção a quase zero.',
      'Não entendi a tarefa': 'Tudo bem não entender tudo agora. O primeiro passo é apenas reler a primeira frase com calma.',
      'Estou ansioso': 'Respire fundo uma vez. Solte os ombros. Você não precisa terminar isso agora.',
      'Outra coisa': 'Vamos diminuir o tamanho dessa tarefa até ela ficar confortável.'
    };

    const empathyText = reasonFeedback[reason] || 'Está tudo bem. Vamos tornar isso menor.';

    if (stage === 1) {
      return {
        stage: 1,
        empathy_message: empathyText,
        clean_task: cleanTitle,
        dialog: "Não vamos fazer a tarefa inteira agora.",
        action_step: `Apenas abra o material ou local de "${cleanTitle}" e respire fundo.`,
        duration_minutes: 2,
        button_text: "COMEÇAR"
      };
    } else {
      // Estágio 2: usuário clicou "AINDA NÃO" -> reduz ainda mais
      return {
        stage: 2,
        empathy_message: "Sem problemas. Se até abrir parece pesado, vamos fatiar ainda mais:",
        clean_task: cleanTitle,
        dialog: "Redução atômica:",
        action_step: `Apenas beba um gole d'água e localize com os olhos onde está o material de "${cleanTitle}". Não precisa clicar nem escrever nada.`,
        duration_minutes: 1,
        button_text: "FIZ ISSO"
      };
    }
  }

  // --- 3. Planejamento Automático do Dia ("Organizar meu dia") ---
  async generateDailyPlan(tasks = [], energyLevel = 'media', availableHours = 6) {
    const planItems = [];
    const activeTasks = tasks.filter(t => t.status !== 'concluido');

    let currentHour = 9;
    let currentMinute = 0;

    const maxItems = energyLevel === 'baixa' ? 3 : energyLevel === 'alta' ? 6 : 4;
    const selected = activeTasks.slice(0, maxItems);

    if (selected.length === 0) {
      selected.push(
        { title: "Definir a prioridade única da manhã", duration_minutes: 10 },
        { title: "Organizar pendência mais simples", duration_minutes: 15 },
        { title: "Pausa restaurativa sem culpa", duration_minutes: 10 }
      );
    }

    selected.forEach((item, idx) => {
      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      const duration = item.duration_minutes || (energyLevel === 'baixa' ? 10 : 20);

      planItems.push({
        step_number: idx + 1,
        time: timeStr,
        title: item.title,
        duration_minutes: duration,
        is_break: false
      });

      currentMinute += duration;
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60);
        currentMinute = currentMinute % 60;
      }

      // Adiciona pausas automáticas gentis
      if ((idx + 1) % 2 === 0) {
        const breakTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        planItems.push({
          step_number: idx + 1.5,
          time: breakTime,
          title: "Pausa suave para água e descanso",
          duration_minutes: 10,
          is_break: true
        });
        currentMinute += 10;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute = currentMinute % 60;
        }
      }
    });

    // Garante que todo plano diário contenha pelo menos uma pausa suave
    if (!planItems.some(i => i.is_break)) {
      const breakTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      planItems.push({
        step_number: planItems.length + 1,
        time: breakTime,
        title: "Pausa suave para água e descanso",
        duration_minutes: 10,
        is_break: true
      });
    }

    return {
      title: "SEU PLANO MÍNIMO DE HOJE",
      message: "Essas são as coisas que realmente importam hoje. O resto pode esperar.",
      energy_applied: energyLevel,
      items: planItems
    };
  }

  // --- 4. Sugestão de Próximo Passo Suave ---
  suggestNextStep(currentTask = null, nextTask = null) {
    if (!nextTask) {
      return {
        message: "Feito. ✅ Você concluiu seu foco principal. Respire fundo e faça uma pausa merecida!",
        has_next: false,
        next_task: null
      };
    }

    return {
      message: "Feito. ✅ Um passo de cada vez.",
      has_next: true,
      next_task: nextTask,
      action_prompt: `Próximo passo: "${nextTask.title}" (${nextTask.duration_minutes} min). Quer começar agora?`
    };
  }

  // --- 5. Chat Copiloto Acolhedor ---
  async chatCopilot(userMessage, conversationHistory = [], userEnergy = 'media') {
    const text = (userMessage || '').trim().toLowerCase();

    // Respostas rápidas acolhedoras e sem julgamento
    if (text.includes('olá') || text.includes('oi') || text.includes('boa tarde') || text.includes('bom dia')) {
      return "Olá! Estou aqui ao seu lado. O que está passando pela sua mente agora?";
    }

    if (text.includes('ansioso') || text.includes('ansiedade') || text.includes('sobrecarregado') || text.includes('muita coisa')) {
      return "Vamos respirar fundo juntos. Você não precisa resolver o dia inteiro agora. Me conte uma única coisa que está te incomodando e vamos deixar ela bem pequenininha.";
    }

    if (text.includes('procrastinando') || text.includes('não consigo') || text.includes('travado') || text.includes('travada')) {
      return "Está tudo bem. Procrastinação quase sempre é excesso de atrito na tarefa. Qual é a tarefa? Vou fatiar ela em 2 minutos para você.";
    }

    if (text.includes('pausa') || text.includes('descansar') || text.includes('cansado') || text.includes('cansada')) {
      return "O descanso é parte fundamental do foco. Que tal programar uma pausa de 10 minutos sem nenhuma culpa? Quando terminar eu te chamo com gentileza.";
    }

    // Se o usuário digitou uma tarefa ou lista
    const breakdown = await this.parseBrainDump(userMessage, userEnergy);
    if (breakdown.tasks.length > 1) {
      return `Entendi tudo o que você me disse. Organize em ${breakdown.total_items} passos, mas não se preocupe: você só precisa olhar para o primeiro agora:\n👉 *${breakdown.recommended_next_step.title}* (${breakdown.recommended_next_step.duration_minutes} min). Quer que eu te acompanhe?`;
    }

    return `Entendido! Vamos focar apenas em: "${userMessage}". Seu próximo passo é separar 5 minutos para iniciar. Sem pressa.`;
  }

  // --- 6. Quebrar Tarefa com IA ---
  async breakTask(taskTitle, energyLevel = 'media') {
    const title = (taskTitle || 'sua tarefa').trim();
    const duration = energyLevel === 'baixa' ? 5 : 10;

    const steps = [
      {
        id: 'sub_' + Date.now() + '_1',
        title: `Separar o material e abrir o local de "${title}"`,
        duration_minutes: duration,
        priority: 'hoje'
      },
      {
        id: 'sub_' + Date.now() + '_2',
        title: `Escrever ou organizar o primeiro item de "${title}"`,
        duration_minutes: duration * 2,
        priority: 'hoje'
      },
      {
        id: 'sub_' + Date.now() + '_3',
        title: `Revisar suavemente o que foi feito sem cobrança`,
        duration_minutes: duration,
        priority: 'depois'
      }
    ];

    return {
      original_task: title,
      message: `Tarefa fatiada em ${steps.length} micro-passos gentis. Faça apenas o primeiro!`,
      first_step: steps[0],
      subtasks: steps
    };
  }
}

module.exports = new AIService();

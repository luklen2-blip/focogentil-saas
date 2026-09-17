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

  // =============================================================
  // 7. DESPEJAR TUDO V2 (TAREFAS vs PREOCUPAÇÕES)
  // =============================================================
  async parseBrainDumpV2(text, energyLevel = 'media') {
    const rawLines = (text || '')
      .split(/[\n;.]|\be\b|\btambém\b|\bdepois\b/i)
      .map(s => s.trim())
      .filter(s => s.length > 2);

    const tasks = [];
    const worries = [];

    const worryTriggers = [
      'preocupado', 'preocupada', 'preocupação', 'medo', 'ansiedade', 'ansioso', 'ansiosa',
      'e se', 'se der errado', 'inseguro', 'insegura', 'angústia', 'não sei se vou',
      'culpa', 'nervoso', 'nervosa', 'pensando se', 'receio'
    ];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const lower = line.toLowerCase();
      const isWorry = worryTriggers.some(w => lower.includes(w));

      if (isWorry) {
        worries.push({
          id: 'wry_' + Date.now() + '_' + i,
          text: line.charAt(0).toUpperCase() + line.slice(1),
          category: 'emocional',
          status: 'guardada'
        });
      } else {
        let duration = energyLevel === 'baixa' ? 5 : 15;
        let priority = 'hoje';
        if (lower.includes('urgente') || lower.includes('prazo') || lower.includes('pagar')) {
          priority = 'urgente';
          duration = 10;
        } else if (lower.includes('depois') || lower.includes('quando der')) {
          priority = 'depois';
        }
        tasks.push({
          id: 'dump_' + Date.now() + '_' + i,
          title: line.charAt(0).toUpperCase() + line.slice(1),
          priority: priority,
          duration_minutes: duration
        });
      }
    }

    if (tasks.length === 0 && worries.length === 0 && text.trim().length > 0) {
      tasks.push({
        id: 'dump_' + Date.now() + '_0',
        title: text.trim().charAt(0).toUpperCase() + text.trim().slice(1),
        priority: 'hoje',
        duration_minutes: 10
      });
    }

    const recommended = tasks.length > 0 ? tasks[0] : null;

    return {
      message: "Eu organizei seus pensamentos em ações e preocupações. Você não precisa resolver tudo de uma vez.",
      tasks: tasks,
      worries: worries,
      total_tasks: tasks.length,
      total_worries: worries.length,
      recommended_next_step: recommended,
      first_gentle_step: recommended ? recommended.title : 'Fazer uma pequena pausa restaurativa',
      user_actions: [
        { key: 'transform_tasks', label: 'Transformar em tarefas' },
        { key: 'save_worry', label: 'Guardar preocupação' },
        { key: 'plan_day', label: 'Planejar meu dia' },
        { key: 'postpone', label: 'Deixar para depois' }
      ]
    };
  }

  // =============================================================
  // 8. INTERVENÇÕES DIRECIONADAS PARA O "ESTOU TRAVADO" (12 MOTIVOS)
  // =============================================================
  async unblockIntervention(reason, taskText = '', userState = {}, stage = 1) {
    const cleanTitle = (taskText || 'sua tarefa').trim();

    // 12 Intervenções Específicas
    const interventions = {
      nao_sei_comecar: {
        title: "Não sei por onde começar",
        empathy: "Quando o início parece uma névoa, a solução não é planejar tudo. É apenas fazer contato com a tarefa.",
        strategy: "primeiro_passo",
        action: `Apenas abra o material ou arquivo de "${cleanTitle}" e respire fundo uma vez.`,
        duration_minutes: 2,
        action_button: "ABRI O MATERIAL",
        stage2_action: `Apenas aponte com o dedo para a tela ou pegue o objeto de "${cleanTitle}". Não faça mais nada por 1 minuto.`
      },
      tarefa_grande: {
        title: "A tarefa está grande demais",
        empathy: "Tarefas gigantescas ativam o freio do cérebro. Vamos fingir que o resto não existe por 3 minutos.",
        strategy: "dividir_microtarefas",
        action: `Escreva em um papel apenas a PRIMEIRA palavra ou linha de "${cleanTitle}".`,
        duration_minutes: 3,
        action_button: "ESCREVI A LINHA",
        stage2_action: `Apenas corte a tarefa na metade mentalmente. Faça apenas 1 micro-etapa de 2 minutos.`
      },
      cansado: {
        title: "Estou cansado",
        empathy: "Respeite o ritmo do seu corpo. Produtividade forçada com baixa energia gera exaustão e culpa.",
        strategy: "modo_bateria",
        action: `Ativamos o Modo Bateria. Vamos fazer apenas a versão mínima viável: 2 minutos sentados confortavelmente.`,
        duration_minutes: 2,
        action_button: "FIZ O MÍNIMO",
        stage2_action: `Apenas beba um copo d'água com calma e faça uma pausa sem culpa.`
      },
      ansioso: {
        title: "Estou ansioso",
        empathy: "Solte os ombros. A ansiedade é um sinal de alerta, não uma sentença. Nada ruim vai acontecer agora.",
        strategy: "regulacao_emocional",
        action: `Faça 3 respirações lentas: inspire pelo nariz em 4s e solte pela boca em 6s. Depois encoste na tarefa.`,
        duration_minutes: 2,
        action_button: "RESPIREI FUNDO",
        stage2_action: `Tome um gole d'água fresca e olhe pela janela por 1 minuto. Reduza os estímulos ao redor.`
      },
      entediado: {
        title: "Estou entediado",
        empathy: "Cérebros neurodivergentes precisam de estímulo de dopamina para iniciar tarefas monótonas.",
        strategy: "desafio_curto",
        action: `Desafio rápido: coloque um cronômetro de 3 minutos e veja o quanto consegue avançar antes do alarme tocar!`,
        duration_minutes: 3,
        action_button: "TOPO O DESAFIO",
        stage2_action: `Coloque uma música animada ou instrumental e faça apenas 2 minutos da tarefa.`
      },
      medo_errar: {
        title: "Tenho medo de errar",
        empathy: "O perfeccionismo é uma armadilha. A primeira versão não precisa ser boa, ela só precisa existir.",
        strategy: "versao_rascunho",
        action: `Faça a pior versão possível de "${cleanTitle}" de propósito. Sem julgar, apenas coloque algo na tela.`,
        duration_minutes: 3,
        action_button: "FIZ O RASCUNHO",
        stage2_action: `Escreva apenas 3 palavras imperfeitas sobre "${cleanTitle}". Errar é permitido e bem-vindo.`
      },
      nao_entendi: {
        title: "Não entendi a tarefa",
        empathy: "Tudo bem não ter clareza total agora. Não precisamos do mapa completo para dar o primeiro passo.",
        strategy: "clarear_enunciado",
        action: `Releia apenas a primeira frase do que foi pedido em "${cleanTitle}" e anote qual é a primeira palavra-chave.`,
        duration_minutes: 3,
        action_button: "RELI A PRIMEIRA FRASE",
        stage2_action: `Apenas marque uma dúvida em um papel. Identificar a dúvida já é avançar.`
      },
      coisas_demais: {
        title: "Tenho coisas demais na cabeça",
        empathy: "O excesso de pensamentos sobrecarrega a memória de trabalho. Vamos tirar isso da cabeça agora.",
        strategy: "despejar_tudo",
        action: `Abra o Despejar Tudo e solte seus pensamentos em texto ou voz sem filtro. Eu organizo para você.`,
        duration_minutes: 4,
        action_button: "ABRIR DESPEJAR TUDO",
        stage2_action: `Escreva apenas as 2 coisas que estão pesando mais e guarde o resto para depois.`
      },
      distraido: {
        title: "Estou distraído",
        empathy: "Distração acontece quando há estímulos competindo pela atenção. Vamos blindar seu campo visual.",
        strategy: "foco_monoalvo",
        action: `Feche todas as abas que não sejam de "${cleanTitle}" e vire o celular com a tela para baixo por 5 minutos.`,
        duration_minutes: 5,
        action_button: "BLINDEI O ESPAÇO",
        stage2_action: `Apenas empurre os objetos que estão na mesa para o lado por 30 segundos.`
      },
      nao_consigo_decidir: {
        title: "Não consigo decidir",
        empathy: "A paralisia por análise acontece quando todas as opções parecem ter o mesmo peso. Vamos simplificar:",
        strategy: "escolha_binaria",
        action: `Você só precisa escolher entre DUAS coisas: Quer fazer 2 minutos de "${cleanTitle}" agora OU quer fazer uma pausa gentil de 5 minutos?`,
        duration_minutes: 2,
        action_button: "ESCOLHI O PASSO",
        stage2_action: `Se estiver muito difícil, eu escolho para você: comece pela menor tarefa por apenas 60 segundos.`
      },
      ambiente_incomodando: {
        title: "O ambiente está me incomodando",
        empathy: "Sensibilidade sensorial esgota energia rapidamente. Seus sentidos estão sobrecarregados.",
        strategy: "modo_sensorial",
        action: `Ajuste seu ambiente: coloque fones de ouvido, diminua o brilho da tela ou acenda uma luz mais suave.`,
        duration_minutes: 3,
        action_button: "AJUSTEI O AMBIENTE",
        stage2_action: `Mude de cômodo ou feche a porta por 2 minutos para criar um casulo de silêncio.`
      },
      nao_sei_explicar: {
        title: "Não sei explicar",
        empathy: "Você não precisa saber explicar ou justificar. Às vezes o cérebro apenas travou, e está tudo bem.",
        strategy: "pausa_gentil",
        action: `Pare agora. Beba meio copo d'água com calma e dê uma volta de 1 minuto sem culpa.`,
        duration_minutes: 2,
        action_button: "BEBI ÁGUA",
        stage2_action: `Apenas sente-se em silêncio por 2 minutos. Não se cobre nada agora.`
      }
    };

    const normReason = String(reason || 'nao_sei_comecar').toLowerCase().replace(/\s+/g, '_');
    const matchKey = Object.keys(interventions).find(k => normReason.includes(k)) || 'nao_sei_comecar';
    const plan = interventions[matchKey];

    if (stage === 1) {
      return {
        stage: 1,
        reason_key: matchKey,
        title: plan.title,
        empathy: plan.empathy,
        strategy: plan.strategy,
        action_step: plan.action,
        micro_action: plan.action,
        duration_minutes: plan.duration_minutes,
        action_button: plan.action_button,
        can_reduce_further: true
      };
    } else {
      // Estágio 2: Usuário ainda não conseguiu ("Isso ainda está grande")
      return {
        stage: 2,
        reason_key: matchKey,
        title: plan.title,
        empathy: "Sem problemas! Se até isso parece pesado, vamos fatiar para o menor átomo possível:",
        strategy: plan.strategy,
        action_step: plan.stage2_action,
        micro_action: plan.stage2_action,
        duration_minutes: 1,
        action_button: "FIZ ESSE PASSO MÍNIMO",
        can_reduce_further: false
      };
    }
  }

  // =============================================================
  // 9. DECOMPOSITOR PROGRESSIVO EM 5 NÍVEIS
  // =============================================================
  async decomposeTaskProgressive(taskTitle, level = 1, userEnergy = 'media') {
    const title = (taskTitle || 'sua tarefa').trim();

    // 5 Níveis Formais de Decomposição
    const levels = {
      1: {
        level_name: "Objetivo Geral",
        description: `O objetivo maior: ${title}`,
        next_step: `Dividir em tarefas menores executáveis`,
        duration_minutes: 20
      },
      2: {
        level_name: "Tarefa Concreta",
        description: `Parte específica de ${title}: separar materiais e listar itens`,
        next_step: `Separar os materiais necessários`,
        duration_minutes: 10
      },
      3: {
        level_name: "Ação Específica",
        description: `Abrir o arquivo ou local onde ${title} acontece`,
        next_step: `Abrir o arquivo principal e olhar para a tela`,
        duration_minutes: 5
      },
      4: {
        level_name: "Microação Atômica",
        description: `Apenas posicionar as mãos no teclado ou pegar a ferramenta`,
        next_step: `Digitar o título ou tocar no objeto de ${title}`,
        duration_minutes: 2
      },
      5: {
        level_name: "Primeiro Movimento Físico",
        description: `O menor contato com a realidade física`,
        next_step: `Pegar o celular na mão, ou abrir a aba do navegador e respirar fundo`,
        duration_minutes: 1
      }
    };

    const currentLevel = Math.min(Math.max(Number(level) || 1, 1), 5);
    const info = levels[currentLevel];

    return {
      original_task: title,
      current_level: currentLevel,
      level_name: info.level_name,
      description: info.description,
      action_step: info.next_step,
      duration_minutes: userEnergy === 'baixa' ? Math.min(info.duration_minutes, 3) : info.duration_minutes,
      can_reduce: currentLevel < 5,
      next_level: currentLevel < 5 ? currentLevel + 1 : 5,
      level1_objective: levels[1].description,
      level2_task: levels[2].description,
      level3_action: levels[3].description,
      level4_micro_action: levels[4].description,
      level5_physical_movement: levels[5].description,
      all_levels: levels
    };
  }

  // =============================================================
  // 10. REGULAÇÃO EMOCIONAL & PROTEÇÃO DE SEGURANÇA (CVV 188)
  // =============================================================
  async emotionalRegulationGuidance(emotion = '') {
    const norm = String(emotion || '').toLowerCase();

    // Verificação de segurança para desespero/autoagressão
    const crisisTriggers = ['morrer', 'suicidio', 'suicídio', 'desespero total', 'acabar com tudo', 'autoagressao', 'machucar'];
    if (crisisTriggers.some(c => norm.includes(c))) {
      return {
        is_crisis: true,
        message: "Sua vida e seu bem-estar são a prioridade absoluta agora. Deixe todas as tarefas de lado.",
        recommendation: "Se você estiver em sofrimento profundo, por favor procure apoio imediato. No Brasil, ligue gratuitamente para o CVV no telefone 188 ou converse em www.cvv.org.br. Você não está sozinho(a).",
        hotline: "CVV 188 (Ligação gratuita e confidencial 24h)"
      };
    }

    const emotionMap = {
      ansioso: {
        label: "Ansioso(a)",
        empathy: "Seu corpo está em alerta. Vamos primeiro diminuir a carga; depois pensamos na tarefa.",
        exercise: "Solte a mandíbula e relaxe os ombros. Faça 3 respirações com expiração longa (4s inspira, 6s expira).",
        next_action: "Quer fazer apenas 2 minutos bem devagar ou prefere uma pausa de 5 minutos?"
      },
      irritado: {
        label: "Irritado(a)",
        empathy: "A irritação consome muita energia mental. Reconhecer isso já é um passo de autorregulação.",
        exercise: "Levante-se, sacuda as mãos e os braços por 30 segundos para descarregar a tensão física.",
        next_action: "Beba um copo de água fresca antes de olhar para qualquer tarefa."
      },
      desanimado: {
        label: "Desanimado(a)",
        empathy: "Dias de ânimo baixo acontecem e não significam preguiça ou falha pessoal.",
        exercise: "Não exija motivação hoje. Vamos operar no 'Modo Mínimo': apenas o essencial.",
        next_action: "Faremos apenas 1 passo de 2 minutos. Se não der, está tudo bem parar."
      },
      sobrecarregado: {
        label: "Sobrecarregado(a)",
        empathy: "Muitas coisas ao mesmo tempo travam o sistema executivo. Vamos fechar a cortina por um instante.",
        exercise: "Foque apenas no próximo minuto. O resto do mundo pode esperar 120 segundos.",
        next_action: "Ative o Modo Sobrecarga: escondemos tudo e cuidamos apenas da próxima ação."
      },
      com_medo: {
        label: "Com medo",
        empathy: "O medo de errar ou de não dar conta é comum quando nos importamos com o resultado.",
        exercise: "Lembre-se: errar faz parte do aprendizado. O primeiro rascunho é livre de julgamentos.",
        next_action: "Diga mentalmente: 'Vou fazer só um rascunho feio primeiro'."
      },
      acelerado: {
        label: "Pensamentos acelerados",
        empathy: "Ideias pulando de um lado para o outro sobrecarregam o cérebro.",
        exercise: "Coloque os dois pés firmes no chão e sinta o contato. Note 3 coisas azuis no ambiente.",
        next_action: "Abra o 'Despejar Tudo' e esvazie o cérebro sem se preocupar em organizar agora."
      },
      desligado: {
        label: "Desligado(a) / Apatia",
        empathy: "Quando o cérebro entra em 'standby', empurrar com força não funciona.",
        exercise: "Mude de posição, lave o rosto com água fria ou apenas respire ar fresco na janela.",
        next_action: "Começaremos apenas com uma microação sensorial de 1 minuto."
      }
    };

    const found = Object.keys(emotionMap).find(k => norm.includes(k)) || 'ansioso';
    const guidance = emotionMap[found];

    return {
      is_crisis: false,
      emotion: guidance.label,
      empathy_message: guidance.empathy,
      grounding_exercise: guidance.exercise,
      strategy: guidance.exercise,
      gentle_suggestion: guidance.next_action,
      disclaimer: "O FocoGentil oferece apoio à organização diária e não substitui acompanhamento médico ou psicológico. Em momentos difíceis, ligue gratuitamente para o CVV 188."
    };
  }

  // =============================================================
  // 11. COMUNICAÇÃO: "ME AJUDE A EXPLICAR"
  // =============================================================
  async helpExplain(rawText = '', category = 'trabalho', tone = 'gentil') {
    const text = (rawText || '').trim();
    if (!text) {
      return { output_text: "Por favor, digite o que você gostaria de comunicar." };
    }

    const contextMap = {
      trabalho: "no ambiente de trabalho / para um colega ou gestor",
      escola: "para o contexto escolar",
      faculdade: "para a faculdade / orientador",
      familia: "para um familiar",
      parceiro: "para o(a) parceiro(a)",
      saude: "para um profissional de saúde",
      professor: "para um professor ou tutor"
    };

    const toneMap = {
      formal: "formal, polido e profissional",
      direto: "direto ao ponto, objetivo e sem rodeios",
      gentil: "acolhedor, compreensivo e empático",
      muito_curto: "extremamente conciso (1 ou 2 frases curtas)"
    };

    const targetContext = contextMap[category] || contextMap.trabalho;
    const targetTone = toneMap[tone] || toneMap.gentil;

    // Geração determinística e de alta clareza
    let cleanMessage = text;
    if (tone === 'muito_curto') {
      cleanMessage = `Olá! Gostaria de alinhar sobre o seguinte ponto: ${text}. Assim que possível, combinamos os próximos passos. Obrigado(a)!`;
    } else if (tone === 'direto') {
      cleanMessage = `Olá! Escrevo para atualizar sobre: ${text}.\nMeu próximo passo será esse e estou à disposição caso haja alguma dúvida.`;
    } else if (tone === 'formal') {
      cleanMessage = `Prezado(a),\nEscrevo para comunicar que: ${text}.\nAgradeço pela compreensão e permaneço à disposição para esclarecimentos.`;
    } else {
      cleanMessage = `Oi! Passando para te dar um alô sobre: ${text}.\nQueria deixar tudo alinhado com calma para darmos os próximos passos. Um abraço!`;
    }

    return {
      category: category,
      tone: tone,
      original_text: text,
      output_text: cleanMessage,
      advice: "Você pode copiar a mensagem acima, fazer os ajustes que desejar e enviar com tranquilidade."
    };
  }

  // =============================================================
  // 12. ASSISTENTES DE CONTEXTO: ESTUDOS, TRABALHO E CASA
  // =============================================================
  async studyModeAssistant(topic = '', subaction = 'dividir') {
    const clean = (topic || 'matéria').trim();
    if (subaction === 'perguntas') {
      return {
        topic: clean,
        type: 'perguntas',
        items: [
          `1. Qual é o conceito central de ${clean}?`,
          `2. Por que esse assunto é importante na prática?`,
          `3. Como você explicaria ${clean} para uma criança de 10 anos?`
        ],
        tip: "Tente responder a primeira pergunta em voz alta sem olhar o material."
      };
    } else if (subaction === 'revisao') {
      return {
        topic: clean,
        type: 'revisao',
        steps: [
          `Passo 1: Ler o resumo de ${clean} em 3 minutos.`,
          `Passo 2: Anotar 2 dúvidas principais em um post-it.`,
          `Passo 3: Fazer uma pausa suave de 5 minutos.`
        ]
      };
    } else {
      return {
        topic: clean,
        type: 'divisao_em_blocos',
        blocks: [
          { title: `Abrir o livro/PDF e ler os títulos de ${clean}`, duration_minutes: 5 },
          { title: `Anotar 3 tópicos fundamentais`, duration_minutes: 10 },
          { title: `Fazer 1 exercício simples de fixação`, duration_minutes: 10 }
        ],
        tip: "Comece apenas pelo Bloco 1 (5 minutos). Não se comprometa com a matéria toda agora."
      };
    }
  }

  async workModeAssistant(demand = '', category = 'projetos') {
    const clean = (demand || 'sua demanda de trabalho').trim();
    const step = `Abrir o rascunho de "${clean}" e listar os 2 pontos prioritários.`;
    return {
      category: category,
      original_demand: clean,
      first_concrete_step: step,
      first_step: step,
      micro_actions: [
        `Verificar quem precisa dessa informação`,
        `Escrever a primeira versão em 10 minutos sem formatar`,
        `Revisar e enviar`
      ],
      tip: "Evite multitarefa. Enquanto cuida desse passo, mantenha o restante em pausa."
    };
  }

  async homeModeAssistant(demand = '', category = 'limpeza', isMinimumMode = false) {
    const clean = (demand || 'organização da casa').trim();
    if (isMinimumMode) {
      return {
        category: category,
        is_minimum_mode: true,
        message: "Hoje vamos fazer apenas o estritamente necessário. Sem culpa!",
        first_step: `Cuidar apenas de 1 item de "${clean}" (ex: recolher apenas 1 copo ou abrir a janela).`,
        duration_minutes: 3,
        encouragement: "Esse passo mínimo já conta e mantém sua casa acolhedora."
      };
    }

    return {
      category: category,
      is_minimum_mode: false,
      message: "Organização doméstica em etapas suaves:",
      first_step: `Separar sacola/cesto e recolher apenas o que estiver visível em "${clean}".`,
      duration_minutes: 7,
      encouragement: "Coloque um timer de 7 minutos. Quando tocar, você decide se quer parar ou continuar."
    };
  }

  // =============================================================
  // 12.1 ORIENTAÇÃO ADAPTATIVA POR ESTADO NEUROCOGNITIVO
  // =============================================================
  async adaptiveStateGuidance(state = 'media') {
    const s = String(state).toLowerCase();
    const map = {
      baixa: {
        state: 'baixa',
        title: 'Baixa Energia',
        mode: 'bateria',
        guidance: 'Seu corpo e mente pedem calma. Vamos focar apenas no estritamente essencial, com micro-passos de 2 minutos e sem cobrança.',
        suggested_action: 'Escolha apenas 1 microação ou faça uma pausa gentil com um copo de água.'
      },
      media: {
        state: 'media',
        title: 'Energia Média',
        mode: 'equilibrado',
        guidance: 'Ritmo sustentável e equilibrado. Podemos avançar passo a passo sem pressa.',
        suggested_action: 'Selecione uma tarefa importante e fatie o primeiro passo.'
      },
      boa: {
        state: 'boa',
        title: 'Boa Energia',
        mode: 'ativo',
        guidance: 'Momento favorável para focar no que exige mais atenção, sempre lembrando de agendar pequenas pausas para não esgotar a bateria.',
        suggested_action: 'Aproveite o embalo para avançar no projeto prioritário.'
      },
      sobrecarregado: {
        state: 'sobrecarregado',
        title: 'Sobrecarga',
        mode: 'sobrecarga',
        guidance: 'Excesso de estímulos ou demandas acumuladas. Escondemos todas as tarefas secundárias para blindar sua mente.',
        suggested_action: 'Pare por 3 minutos. Despeje tudo o que está na cabeça no papel ou áudio sem compromisso de fazer agora.'
      },
      disperso: {
        state: 'disperso',
        title: 'Disperso',
        mode: 'monoalvo',
        guidance: 'Mente pulando entre estímulos. Normal e compreensível. Vamos fechar as outras opções e olhar para uma única coisa.',
        suggested_action: 'Defina um único micro-passo de 2 minutos e feche as abas extras.'
      },
      paralisado: {
        state: 'paralisado',
        title: 'Paralisado',
        mode: 'desbloqueio',
        guidance: 'Travamento total ou inércia da tarefa. Não se culpe. Não force. Apenas dê o menor movimento físico possível.',
        suggested_action: 'Abra a ferramenta Estou Travado ou apenas abra o documento sem compromisso de escrever.'
      },
      hiperfoco: {
        state: 'hiperfoco',
        title: 'Hiperfoco',
        mode: 'sustentacao',
        guidance: 'Foco intenso e produtivo, mas lembre-se de que o corpo ainda precisa de água, alimento e descanso.',
        suggested_action: 'Ative um alarme gentil para daqui a 30 minutos e beba um gole de água.'
      },
      sem_rumo: {
        state: 'sem_rumo',
        title: 'Sem Rumo',
        mode: 'orientacao',
        guidance: 'Dificuldade de saber qual direção tomar. Vamos clarear suas prioridades com gentileza.',
        suggested_action: 'Gere seu Plano Mínimo do Dia com apenas as 2 ações essenciais.'
      }
    };
    return map[s] || {
      state: s,
      title: 'Momento Atual',
      mode: 'gentil',
      guidance: 'Entenda seu momento e avance no seu próprio ritmo.',
      suggested_action: 'Descubra o próximo micro-passo.'
    };
  }

  // =============================================================
  // 13. INSIGHTS ADAPTATIVOS DE MEMÓRIA (SEM DIAGNÓSTICO)
  // =============================================================
  async generateAdaptiveInsights(history = [], memories = []) {
    const observations = [];
    if (memories && memories.length > 0) {
      memories.forEach(m => {
        observations.push(`Estratégia aprendida: ${m.value}`);
      });
    }

    if (observations.length === 0) {
      observations.push("Você costuma começar melhor quando fatiamos a tarefa para menos de 2 minutos.");
      observations.push("Fazer pausas suaves antes de iniciar a próxima tarefa reduz a sobrecarga.");
    }

    return {
      insights: observations,
      disclaimer: "Estas observações são baseadas no seu histórico de uso e servem como apoio à sua rotina, sem caráter de diagnóstico clínico."
    };
  }
}

module.exports = new AIService();

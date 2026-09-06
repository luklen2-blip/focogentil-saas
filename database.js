/**
 * Camada de persistência local autônoma para o FocoGentil Copilot V2.
 * Armazena usuários, projetos, microtarefas, lembretes, sessões de autenticação,
 * tarefas estruturadas, logs de energia, histórico de IA e compras.
 * Opera com a biblioteca padrão do Node.js (crypto, fs, path).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'focogentil_data.json');

class LocalDatabase {
  constructor() {
    this.data = {
      users: {},            // { id_or_phone: { id, phone_number, email, password_hash, salt, name, is_lifetime_active, plan, ... } }
      sessions: {},         // { token: { user_id, created_at, expires_at } }
      tasks: [],            // [ { id, user_id, title, status: 'agora'|'proximo'|'depois'|'concluido', priority, duration_minutes, created_at, completed_at } ]
      projects: [],         // [ { id, user_phone, user_id, title, energy_level, created_at, micro_tasks: [] } ]
      reminders: [],        // [ { id, user_phone, user_id, task_title, duration_minutes, scheduled_at, is_dispatched, status } ]
      routines: [],         // [ { id, user_id, title, scheduled_time, active } ]
      events: [],           // [ { id, user_id, title, scheduled_at, duration_minutes } ]
      focus_sessions: [],   // [ { id, user_id, task_id, duration_minutes, completed, started_at } ]
      energy_logs: [],      // [ { id, user_id, energy_level, timestamp } ]
      ai_conversations: [], // [ { id, user_id, created_at } ]
      ai_messages: [],      // [ { id, conversation_id, user_id, role, content, timestamp } ]
      subscriptions: [],    // [ { id, user_id, plan, status: 'active'|'cancelled', started_at } ]
      payments: [],         // [ { payment_id, user_phone, user_id, amount, status: 'pending'|'approved'|'failed'|'cancelled', provider, created_at, is_recurring: false } ]
      billing_settings: {
        price: 97.00,
        pix_key: 'contato.focogentil@gmail.com',
        pix_name: 'FOCOGENTIL',
        pix_city: 'SAO PAULO',
        mercadopago_token: ''
      }
    };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const loaded = JSON.parse(raw);
        this.data = { ...this.data, ...loaded };
        
        // Garante que todas as coleções existam
        if (!this.data.sessions) this.data.sessions = {};
        if (!this.data.tasks) this.data.tasks = [];
        if (!this.data.routines) this.data.routines = [];
        if (!this.data.events) this.data.events = [];
        if (!this.data.focus_sessions) this.data.focus_sessions = [];
        if (!this.data.energy_logs) this.data.energy_logs = [];
        if (!this.data.ai_conversations) this.data.ai_conversations = [];
        if (!this.data.ai_messages) this.data.ai_messages = [];
        if (!this.data.subscriptions) this.data.subscriptions = [];
        if (!this.data.payments) this.data.payments = [];
        if (!this.data.billing_settings) {
          this.data.billing_settings = {
            price: 97.00,
            pix_key: 'contato.focogentil@gmail.com',
            pix_name: 'FOCOGENTIL',
            pix_city: 'SAO PAULO',
            mercadopago_token: ''
          };
        }
      } else {
        this._save();
      }
    } catch (err) {
      console.warn('[Database] Criando novo banco de dados local.');
      this._save();
    }
  }

  _save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Database] Erro ao salvar dados:', err);
    }
  }

  normalizePhone(phone) {
    if (!phone) return '';
    let clean = String(phone).replace('whatsapp:', '').replace(/\s+/g, '').replace(/-/g, '');
    if (!clean.startsWith('+')) clean = '+' + clean;
    return clean;
  }

  // --- Criptografia e Senhas com PBKDF2 ---
  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }

  // --- Usuários e Autenticação Real ---
  createUser({ email, password, name, phone = null, plan = 'gratuito' }) {
    const cleanEmail = String(email).trim().toLowerCase();
    
    // Verifica duplicidade por email
    const existing = Object.values(this.data.users).find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('E-mail já cadastrado no sistema.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const normPhone = phone ? this.normalizePhone(phone) : null;

    const newUser = {
      id: userId,
      email: cleanEmail,
      password_hash: passwordHash,
      salt: salt,
      name: name || cleanEmail.split('@')[0],
      phone_number: normPhone,
      plan: plan, // 'gratuito', 'pro', 'vitalicio'
      is_lifetime_active: plan === 'vitalicio',
      has_recurring_subscription: false,
      paid_at: plan === 'vitalicio' ? new Date().toISOString() : null,
      energy_level: 'media',
      quiet_hours_start: 22,
      quiet_hours_end: 8,
      focus_duration_min: 25,
      break_duration_min: 5,
      calm_mode: false,
      created_at: new Date().toISOString(),
      trial_started_at: new Date().toISOString(),
      trial_duration_minutes: 30
    };

    // Indexa por ID e também por telefone se existir (para compatibilidade total com Twilio/WhatsApp)
    this.data.users[userId] = newUser;
    if (normPhone) {
      this.data.users[normPhone] = newUser;
    }

    this._save();
    return this.sanitizeUser(newUser);
  }

  verifyUserPassword(email, password) {
    const cleanEmail = String(email).trim().toLowerCase();
    const user = Object.values(this.data.users).find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (!user || !user.password_hash || !user.salt) return null;

    const hash = this.hashPassword(password, user.salt);
    if (hash === user.password_hash) {
      return this.sanitizeUser(user);
    }
    return null;
  }

  findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = String(email).trim().toLowerCase();
    return Object.values(this.data.users).find(u => u.email && u.email.toLowerCase() === cleanEmail) || null;
  }

  createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
    this.data.sessions[token] = {
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    };
    this._save();
    return token;
  }

  getSessionUser(token) {
    if (!token || !this.data.sessions[token]) return null;
    const session = this.data.sessions[token];
    if (new Date(session.expires_at) < new Date()) {
      delete this.data.sessions[token];
      this._save();
      return null;
    }
    const user = this.getUserById(session.user_id);
    return user ? this.sanitizeUser(user) : null;
  }

  deleteSession(token) {
    if (this.data.sessions[token]) {
      delete this.data.sessions[token];
      this._save();
      return true;
    }
    return false;
  }

  getUserById(id) {
    return Object.values(this.data.users).find(u => u.id === id) || this.data.users[id] || null;
  }

  getUserByEmail(email) {
    const cleanEmail = String(email).trim().toLowerCase();
    return Object.values(this.data.users).find(u => u.email && u.email.toLowerCase() === cleanEmail) || null;
  }

  sanitizeUser(user) {
    if (!user) return null;
    const { password_hash, salt, ...safe } = user;
    return safe;
  }

  updateUserProfile(userId, updates) {
    const user = this.getUserById(userId);
    if (!user) return null;

    const allowed = ['name', 'energy_level', 'quiet_hours_start', 'quiet_hours_end', 'focus_duration_min', 'break_duration_min', 'calm_mode', 'plan', 'phone_number'];
    allowed.forEach(k => {
      if (updates[k] !== undefined) user[k] = updates[k];
    });

    if (updates.phone_number) {
      const norm = this.normalizePhone(updates.phone_number);
      user.phone_number = norm;
      this.data.users[norm] = user;
    }

    this._save();
    return this.sanitizeUser(user);
  }

  // --- Usuários Legados e WhatsApp (Compatibilidade Total) ---
  getUser(phone) {
    const norm = this.normalizePhone(phone);
    return this.data.users[norm] || Object.values(this.data.users).find(u => u.phone_number === norm) || null;
  }

  registerOrGetUser(phone, name = null) {
    const norm = this.normalizePhone(phone);
    let existing = this.getUser(norm);
    if (!existing) {
      const userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      existing = {
        id: userId,
        phone_number: norm,
        email: null,
        password_hash: null,
        salt: null,
        name: name || 'Amigo(a)',
        plan: 'gratuito',
        is_lifetime_active: false,
        has_recurring_subscription: false,
        paid_at: null,
        energy_level: 'media',
        quiet_hours_start: 22,
        quiet_hours_end: 8,
        focus_duration_min: 25,
        break_duration_min: 5,
        calm_mode: false,
        created_at: new Date().toISOString(),
        trial_started_at: new Date().toISOString(),
        trial_duration_minutes: 30
      };
      this.data.users[norm] = existing;
      this.data.users[userId] = existing;
      this._save();
    }
    return existing;
  }

  getTrialStatus(phone) {
    const user = this.getUser(phone);
    if (!user) {
      return { in_trial: false, remaining_seconds: 0, is_lifetime: false };
    }
    if (user.is_lifetime_active || user.plan === 'vitalicio' || user.plan === 'pro') {
      return { in_trial: false, remaining_seconds: 0, is_lifetime: true };
    }
    const startedAt = new Date(user.trial_started_at || user.created_at || Date.now()).getTime();
    const durationMs = (user.trial_duration_minutes || 30) * 60 * 1000;
    const expiresAt = startedAt + durationMs;
    const now = Date.now();
    const remainingMs = expiresAt - now;

    if (remainingMs > 0) {
      return {
        in_trial: true,
        remaining_seconds: Math.floor(remainingMs / 1000),
        remaining_minutes: Math.ceil(remainingMs / 60000),
        is_lifetime: false
      };
    } else {
      return {
        in_trial: false,
        remaining_seconds: 0,
        remaining_minutes: 0,
        is_lifetime: false
      };
    }
  }

  expireTrialNow(phone) {
    const user = this.registerOrGetUser(phone);
    user.trial_started_at = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    this._save();
    return user;
  }

  resetTrial(phone) {
    const user = this.registerOrGetUser(phone);
    user.trial_started_at = new Date().toISOString();
    this._save();
    return user;
  }

  activateLifetimeLicense(phone, paymentId, amount, provider, customerName = null) {
    const norm = this.normalizePhone(phone);
    const user = this.registerOrGetUser(norm, customerName);
    
    user.is_lifetime_active = true;
    user.plan = 'vitalicio';
    user.has_recurring_subscription = false;
    user.paid_at = new Date().toISOString();
    if (customerName) user.name = customerName;

    this.data.payments.push({
      payment_id: String(paymentId),
      user_phone: norm,
      user_id: user.id || norm,
      amount: Number(amount),
      provider: provider || 'mercadopago',
      status: 'approved',
      created_at: new Date().toISOString(),
      is_recurring: false
    });

    this._save();
    return user;
  }

  activateProSubscription(phoneOrEmail, paymentId, amount = 29.00, provider = 'cartao_recorrente', customerName = null) {
    let user = null;
    const isEmail = String(phoneOrEmail).includes('@');
    if (isEmail) {
      user = this.getUserByEmail(phoneOrEmail);
    } else {
      const norm = this.normalizePhone(phoneOrEmail);
      user = this.registerOrGetUser(norm, customerName);
    }

    if (!user) {
      user = this.createUser({
        email: isEmail ? phoneOrEmail : `user_${Date.now()}@focogentil.com`,
        password: 'User@' + Date.now(),
        name: customerName || 'Assinante Pro',
        phone: isEmail ? null : phoneOrEmail,
        plan: 'pro'
      });
    } else {
      user.plan = 'pro';
      user.has_recurring_subscription = true;
      user.paid_at = new Date().toISOString();
      if (customerName && (!user.name || user.name === 'Amigo(a)')) user.name = customerName;
    }

    this.data.payments.push({
      payment_id: String(paymentId),
      user_phone: user.phone_number || (isEmail ? null : phoneOrEmail),
      user_id: user.id,
      amount: Number(amount),
      provider: provider,
      status: 'approved',
      created_at: new Date().toISOString(),
      is_recurring: true
    });

    this._save();
    return user;
  }

  // --- Ciclo de Vida de Pagamentos Comerciais (Status: pending, approved, failed, cancelled, refunded) ---
  createPendingPayment({ payment_id, user_id, phone, email, amount, plan = 'vitalicio', provider = 'pix', customer_name = null }) {
    const payment = {
      payment_id: String(payment_id),
      user_phone: phone ? this.normalizePhone(phone) : null,
      user_id: user_id || null,
      customer_name: customer_name || 'Cliente',
      customer_email: email || null,
      amount: Number(amount),
      plan: plan || 'vitalicio',
      provider: provider || 'pix',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_recurring: plan === 'pro' || plan === 'mensal'
    };
    this.data.payments.push(payment);
    this._save();
    return payment;
  }

  getPaymentById(paymentId) {
    if (!paymentId) return null;
    return this.data.payments.find(p => p.payment_id === String(paymentId)) || null;
  }

  updatePaymentStatus(paymentId, newStatus) {
    const validStatuses = ['pending', 'approved', 'failed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status inválido: ${newStatus}. Status permitidos: ${validStatuses.join(', ')}`);
    }

    const payment = this.getPaymentById(paymentId);
    if (!payment) return null;

    payment.status = newStatus;
    payment.updated_at = new Date().toISOString();

    let user = null;
    if (newStatus === 'approved') {
      const targetPhone = payment.user_phone;
      const targetEmail = payment.customer_email;
      const plan = payment.plan === 'pro' || payment.plan === 'mensal' ? 'pro' : 'vitalicio';

      if (plan === 'vitalicio' && targetPhone) {
        const norm = this.normalizePhone(targetPhone);
        user = this.registerOrGetUser(norm, payment.customer_name);
        user.is_lifetime_active = true;
        user.plan = 'vitalicio';
        user.has_recurring_subscription = false;
        user.paid_at = new Date().toISOString();
        if (payment.customer_name) user.name = payment.customer_name;
      } else if (plan === 'pro') {
        const target = targetEmail || targetPhone;
        const isEmail = target && target.includes('@');
        user = isEmail ? this.getUserByEmail(target) : this.getUser(target);
        if (user) {
          user.plan = 'pro';
          user.has_recurring_subscription = true;
          user.paid_at = new Date().toISOString();
        } else {
          user = this.createUser({
            email: isEmail ? target : `user_${Date.now()}@focogentil.com`,
            password: 'User@' + Date.now(),
            name: payment.customer_name || 'Assinante Pro',
            phone: isEmail ? null : target,
            plan: 'pro'
          });
        }
      } else if (targetPhone) {
        const norm = this.normalizePhone(targetPhone);
        user = this.registerOrGetUser(norm, payment.customer_name);
        user.is_lifetime_active = true;
        user.plan = 'vitalicio';
      }
    }

    this._save();
    return { payment, user };
  }

  getAllPaymentsList() {
    return [...this.data.payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  isAuthorized(phone) {
    const user = this.getUser(phone);
    if (!user) return false;
    if (user.is_lifetime_active || user.plan === 'vitalicio' || user.plan === 'pro') {
      return true;
    }
    const trial = this.getTrialStatus(phone);
    return trial.in_trial;
  }

  setUserEnergy(phone, energy) {
    const user = this.registerOrGetUser(phone);
    user.energy_level = energy;
    this.logUserEnergy(user.id || user.phone_number, energy);
    this._save();
    return user;
  }

  logUserEnergy(userId, level) {
    const log = {
      id: 'en_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      user_id: userId,
      energy_level: level,
      timestamp: new Date().toISOString()
    };
    this.data.energy_logs.push(log);
    this._save();
    return log;
  }

  // --- Tarefas Estruturadas (SaaS V2) ---
  createTask(userId, { title, description = '', priority = 'hoje', duration_minutes = 10, status = null, parent_id = null }) {
    const userTasks = this.data.tasks.filter(t => t.user_id === userId && t.status !== 'concluido');
    
    // Se o usuário não tem nenhuma tarefa no AGORA, a primeira tarefa criada vai direto para o AGORA
    let finalStatus = status;
    if (!finalStatus) {
      const hasAgora = userTasks.some(t => t.status === 'agora');
      finalStatus = hasAgora ? 'proximo' : 'agora';
    }

    const task = {
      id: 'tsk_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      priority: priority, // 'urgente' | 'importante' | 'hoje' | 'depois' | 'baixa'
      duration_minutes: Number(duration_minutes) || 10,
      status: finalStatus, // 'agora' | 'proximo' | 'depois' | 'concluido'
      parent_id: parent_id,
      created_at: new Date().toISOString(),
      completed_at: null
    };

    this.data.tasks.push(task);
    this._save();
    return task;
  }

  getUserTasks(userId, statusFilter = null) {
    return this.data.tasks.filter(t => {
      if (t.user_id !== userId) return false;
      if (statusFilter) return t.status === statusFilter;
      return true;
    });
  }

  getTaskById(userId, taskId) {
    return this.data.tasks.find(t => t.id === taskId && t.user_id === userId) || null;
  }

  updateTask(userId, taskId, updates) {
    const task = this.getTaskById(userId, taskId);
    if (!task) return null;

    const allowed = ['title', 'description', 'priority', 'duration_minutes', 'status'];
    allowed.forEach(k => {
      if (updates[k] !== undefined) task[k] = updates[k];
    });

    if (updates.status === 'concluido' && !task.completed_at) {
      task.completed_at = new Date().toISOString();
    }

    this._save();
    return task;
  }

  completeTask(userId, taskId) {
    const task = this.getTaskById(userId, taskId);
    if (!task) return null;

    task.status = 'concluido';
    task.completed_at = new Date().toISOString();

    // Se concluiu a tarefa do AGORA, promove automaticamente o primeiro "proximo" para "agora"
    const nextTask = this.data.tasks.find(t => t.user_id === userId && t.status === 'proximo');
    if (nextTask) {
      nextTask.status = 'agora';
    }

    this._save();
    return { completed: task, promoted_next: nextTask || null };
  }

  deleteTask(userId, taskId) {
    const idx = this.data.tasks.findIndex(t => t.id === taskId && t.user_id === userId);
    if (idx !== -1) {
      const removed = this.data.tasks.splice(idx, 1)[0];
      // Se deletou a do AGORA, promove o próximo
      if (removed.status === 'agora') {
        const nextTask = this.data.tasks.find(t => t.user_id === userId && t.status === 'proximo');
        if (nextTask) nextTask.status = 'agora';
      }
      this._save();
      return true;
    }
    return false;
  }

  // --- Sessões de Foco ---
  startFocusSession(userId, taskId, durationMinutes) {
    const session = {
      id: 'foc_' + Date.now(),
      user_id: userId,
      task_id: taskId,
      duration_minutes: durationMinutes,
      started_at: new Date().toISOString(),
      completed: false
    };
    this.data.focus_sessions.push(session);
    this._save();
    return session;
  }

  finishFocusSession(sessionId, completed = true) {
    const s = this.data.focus_sessions.find(f => f.id === sessionId);
    if (s) {
      s.completed = completed;
      s.ended_at = new Date().toISOString();
      this._save();
    }
    return s;
  }

  // --- Mensagens e IA Copilot ---
  saveAiMessage(userId, conversationId, role, content) {
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      conversation_id: conversationId,
      user_id: userId,
      role: role, // 'user' | 'assistant'
      content: content,
      timestamp: new Date().toISOString()
    };
    this.data.ai_messages.push(msg);
    this._save();
    return msg;
  }

  getAiMessages(userId, conversationId) {
    return this.data.ai_messages.filter(m => m.user_id === userId && m.conversation_id === conversationId);
  }

  // --- Projetos Legados e WhatsApp ---
  saveProject(userPhone, projectData) {
    const norm = this.normalizePhone(userPhone);
    const projectId = 'proj_' + Date.now();
    const newProject = {
      id: projectId,
      user_phone: norm,
      title: projectData.project_title,
      energy_level: projectData.energy_level || 'media',
      gentle_tip: projectData.gentle_tip || '',
      created_at: new Date().toISOString(),
      micro_tasks: projectData.micro_tasks || []
    };
    this.data.projects.push(newProject);
    this._save();
    return newProject;
  }

  getLatestProject(userPhone) {
    const norm = this.normalizePhone(userPhone);
    const userProjects = this.data.projects.filter(p => p.user_phone === norm);
    return userProjects[userProjects.length - 1] || null;
  }

  // --- Lembretes Gentis ---
  scheduleReminder(userPhone, taskTitle, durationMinutes, delayMinutes = null) {
    const norm = this.normalizePhone(userPhone);
    const user = this.registerOrGetUser(norm);
    
    const minutesToAdd = delayMinutes !== null ? delayMinutes : durationMinutes;
    const targetDate = new Date(Date.now() + minutesToAdd * 60000);

    // Ajuste de horário de sono (22h - 08h)
    const hour = targetDate.getHours();
    if (hour >= user.quiet_hours_start || hour < user.quiet_hours_end) {
      if (hour >= user.quiet_hours_start) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      targetDate.setHours(user.quiet_hours_end + 1, 0, 0, 0);
    }

    const reminder = {
      id: 'rem_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      user_phone: norm,
      task_title: taskTitle,
      duration_minutes: durationMinutes,
      scheduled_at: targetDate.toISOString(),
      is_dispatched: false,
      status: 'pending'
    };

    this.data.reminders.push(reminder);
    this._save();
    return reminder;
  }

  getDueReminders() {
    const now = new Date();
    return this.data.reminders.filter(
      r => !r.is_dispatched && new Date(r.scheduled_at) <= now
    );
  }

  markReminderDispatched(reminderId) {
    const reminder = this.data.reminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.is_dispatched = true;
      reminder.status = 'dispatched';
      this._save();
    }
  }

  // --- Métricas e Painel Administrativo V2 ---
  getAllStats() {
    const totalUsers = Object.keys(this.data.users).length;
    const activeLifetime = Object.values(this.data.users).filter(u => u.is_lifetime_active || u.plan === 'vitalicio').length;
    const totalTasks = this.data.tasks.length;
    const completedTasks = this.data.tasks.filter(t => t.status === 'concluido').length;
    const totalPayments = this.data.payments.length;
    const approvedPayments = this.data.payments.filter(p => p.status === 'approved');
    const totalRevenue = approvedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalFocusMinutes = this.data.focus_sessions.reduce((acc, f) => acc + (Number(f.duration_minutes) || 0), 0);

    return {
      total_users: totalUsers,
      active_lifetime_users: activeLifetime,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      total_projects: this.data.projects.length,
      total_reminders: this.data.reminders.length,
      pending_reminders: this.data.reminders.filter(r => !r.is_dispatched).length,
      total_focus_minutes: totalFocusMinutes,
      total_payments_count: totalPayments,
      approved_payments_count: approvedPayments.length,
      total_revenue_brl: totalRevenue,
      total_ai_messages: this.data.ai_messages.length
    };
  }

  getAllUsersList() {
    // Retorna lista sem dados sensíveis
    return Object.values(this.data.users).map(u => this.sanitizeUser(u));
  }

  getBillingSettings() {
    return this.data.billing_settings || {
      price: 97.00,
      pix_key: 'contato.focogentil@gmail.com',
      pix_name: 'FOCOGENTIL',
      pix_city: 'SAO PAULO',
      mercadopago_token: ''
    };
  }

  updateBillingSettings(newSettings) {
    this.data.billing_settings = {
      ...this.getBillingSettings(),
      ...newSettings
    };
    if (newSettings.price !== undefined) {
      this.data.billing_settings.price = Number(newSettings.price);
    }
    this._save();
    return this.data.billing_settings;
  }
}

module.exports = new LocalDatabase();

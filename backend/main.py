from fastapi import FastAPI, Request, Form, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime

from models import (
    EnergyLevel,
    PaymentVerificationRequest,
    ProjectBreakdown,
    MicroTask,
    TaskStatus
)
from services.decomposition import NeuroDecompositionEngine
from services.scheduler import NeuroScheduler
from services.license_manager import LicenseManager
from services.twilio_client import TwilioWhatsAppService

app = FastAPI(
    title="FocoGentil API - Copiloto de Produtividade Neurodivergente",
    description="API com decomposição de tarefas, lembretes gentis e suporte a pagamento único.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialização dos serviços
engine = NeuroDecompositionEngine()
scheduler = NeuroScheduler()
license_mgr = LicenseManager()
twilio_service = TwilioWhatsAppService()

# Armazenamento simples de estado de projetos em andamento por usuário
user_active_projects = {}

@app.get("/")
def home():
    return {
        "status": "online",
        "app": "FocoGentil - Copiloto Neurodivergente",
        "billing_model": "Pagamento Único (Sem mensalidade)",
        "channel": "WhatsApp via Twilio & n8n"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/webhook/payment")
def payment_webhook(payload: PaymentVerificationRequest):
    """
    Webhook acionado quando o gateway de pagamento (Mercado Pago / Stripe / Hotmart)
    confirma a compra única do produto.
    Garante que não haja recorrência e ativa o número de WhatsApp.
    """
    try:
        user = license_mgr.process_one_time_payment(payload)
        
        # Mensagem de boas-vindas comemorativa
        welcome_msg = (
            f"🎉 *Parabéns, {user.name or 'amigo(a)'}! Seu acesso vitalício está liberado!*\n\n"
            "Eu sou o *FocoGentil*, seu copiloto antiparalisia.\n"
            "Você fez um pagamento único e NUNCA terá cobranças extras ou mensalidades.\n\n"
            "💬 *Como começar?*\n"
            "Me envie qualquer projeto ou tarefa em que você esteja pensando agora. "
            "Pode ser texto ou áudio!\n\n"
            "Exemplo: _'Preciso limpar meu quarto e organizar os estudos para a prova'_"
        )
        
        twilio_service.send_whatsapp_message(to_phone=user.phone_number, body=welcome_msg)
        
        return {
            "success": True,
            "message": "Licença vitalícia ativada com sucesso!",
            "phone": user.phone_number,
            "has_recurring_subscription": False
        }
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

@app.post("/webhook/twilio")
async def twilio_inbound_webhook(
    request: Request,
    From: str = Form(...),
    Body: Optional[str] = Form(None),
    ProfileName: Optional[str] = Form(None)
):
    """
    Webhook principal do Twilio WhatsApp.
    Recebe as mensagens dos usuários, checa a licença e responde.
    """
    clean_phone = license_mgr.normalize_phone(From)
    
    # 1. Verifica se o usuário tem a licença vitalícia paga
    if not license_mgr.is_user_authorized(clean_phone):
        # Usuário ainda não comprou a licença única
        license_mgr.register_or_get_user(clean_phone, name=ProfileName)
        invitation = license_mgr.get_checkout_invitation_message()
        return Response(
            content=twilio_service.build_twiml_response(invitation),
            media_type="application/xml"
        )

    user = license_mgr.register_or_get_user(clean_phone, name=ProfileName)
    user_input = (Body or "").strip()

    # 2. Processa respostas rápidas (1, 2, 3)
    if user_input == "1":
        # Opção 1: Passo concluído!
        reply = (
            "🌟 *Vitória comemorada!* Parabéns pelo micropasso concluído!\n"
            "Micro-vitória conquistada! Quer fazer mais um pequeno passo agora ou prefere uma pausa?\n\n"
            "Responda com o próximo desafio ou digite *PAUSA* para relaxar 15 min."
        )
        return Response(
            content=twilio_service.build_twiml_response(reply),
            media_type="application/xml"
        )

    elif user_input == "2":
        # Opção 2: Travou, quer quebrar em menor ainda
        reply = (
            "🤏 *Sem problemas!* Vamos quebrar ainda mais.\n"
            "Seu único objetivo nos próximos 2 minutos é:\n"
            "👉 *Apenas abrir a aba ou pegar o material na mão e respirar fundo.*\n\n"
            "Não precisa começar nada complexo. Quando pegar, mande *OK*."
        )
        return Response(
            content=twilio_service.build_twiml_response(reply),
            media_type="application/xml"
        )

    elif user_input == "3":
        # Opção 3: Adiar 30 min sem culpa
        reply = (
            "⏸️ *Pausa sem culpa anotada!* O descanso também é produtivo.\n"
            "Vou te mandar um alô gentil daqui a 30 minutos. Beba uma água! 💧"
        )
        # Agenda lembrete de reativação para daqui a 30 min
        dummy_task = MicroTask(
            step_number=1,
            title="Retomar com leveza após a pausa",
            duration_minutes=5,
            urgency_score=3
        )
        scheduler.schedule_micro_task(user, dummy_task, delay_minutes=30)
        
        return Response(
            content=twilio_service.build_twiml_response(reply),
            media_type="application/xml"
        )

    # 3. Caso não seja atalho numérico: decompor o projeto/tarefa
    breakdown = engine.decompose_project(
        project_description=user_input,
        energy_level=user.current_energy_level
    )
    user_active_projects[clean_phone] = breakdown

    # Agenda lembrete automático da primeira etapa (ignição)
    first_task = breakdown.micro_tasks[0]
    scheduler.schedule_micro_task(user, first_task)

    response_text = engine.format_whatsapp_response(breakdown)
    return Response(
        content=twilio_service.build_twiml_response(response_text),
        media_type="application/xml"
    )

@app.post("/cron/dispatch-reminders")
def dispatch_due_reminders():
    """
    Endpoint chamado periodicamente pelo n8n (nó Cron) para disparar lembretes agendados.
    """
    due_reminders = scheduler.get_pending_due_reminders()
    dispatched_count = 0

    for rem in due_reminders:
        message = scheduler.format_reminder_message(
            task_title=rem.task_title,
            duration_minutes=rem.duration_minutes
        )
        sent = twilio_service.send_whatsapp_message(
            to_phone=rem.user_phone,
            body=message
        )
        if sent:
            scheduler.mark_as_dispatched(rem.id)
            dispatched_count += 1

    return {
        "status": "success",
        "reminders_found": len(due_reminders),
        "reminders_dispatched": dispatched_count
    }

@app.post("/decompose", response_model=ProjectBreakdown)
def api_decompose(project: str, energy: EnergyLevel = EnergyLevel.MEDIUM):
    """Permite que o n8n ou outro frontend invoque o motor de decomposição diretamente."""
    return engine.decompose_project(project_description=project, energy_level=energy)

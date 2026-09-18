import sys
import os
from pathlib import Path
import pytest

# Adiciona o diretório backend ao sys.path para importação direta dos módulos
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from models import (
    EnergyLevel,
    PaymentVerificationRequest,
    UserProfile,
    MicroTask,
    TaskStatus
)
from services.decomposition import NeuroDecompositionEngine
from services.scheduler import NeuroScheduler
from services.license_manager import LicenseManager
from services.twilio_client import TwilioWhatsAppService
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

# -------------------------------------------------------------
# 1. Testes de Decomposição Neurodivergente (Anti-Paralisia)
# -------------------------------------------------------------
def test_decomposition_generates_atomic_first_step():
    """Garante que a primeira etapa é de baixa fricção (<= 5 minutos) para quebrar a inércia."""
    engine = NeuroDecompositionEngine()
    result = engine.decompose_project(
        project_description="Terminar o relatório financeiro do mês",
        energy_level=EnergyLevel.LOW
    )
    
    assert len(result.micro_tasks) >= 3
    first_step = result.micro_tasks[0]
    assert first_step.step_number == 1
    # O primeiro passo deve ser rápido para não disparar sobrecarga
    assert first_step.duration_minutes <= 5
    assert result.energy_level == EnergyLevel.LOW
    assert len(result.gentle_tip) > 0

def test_whatsapp_formatting_contains_quick_action_options():
    """Valida se a mensagem para o WhatsApp contém opções curtas por número (1, 2, 3)."""
    engine = NeuroDecompositionEngine()
    breakdown = engine.decompose_project("Organizar documentos para o imposto de renda")
    msg = engine.format_whatsapp_response(breakdown)

    assert "Passo 1" in msg
    assert "*1*" in msg
    assert "*2*" in msg
    assert "*3*" in msg
    assert "⏱️" in msg

# -------------------------------------------------------------
# 2. Testes de Agendamento Gentil & Respeito ao Sono
# -------------------------------------------------------------
def test_scheduler_respects_quiet_hours():
    """Garante que nenhum lembrete é agendado durante a madrugada/horário de descanso."""
    scheduler = NeuroScheduler()
    user = UserProfile(
        phone_number="+5511999991111",
        quiet_hours_start=22,
        quiet_hours_end=8
    )
    task = MicroTask(
        step_number=1,
        title="Revisar 1 parágrafo",
        duration_minutes=10,
        urgency_score=3
    )

    # Agenda a tarefa
    reminder = scheduler.schedule_micro_task(user, task)
    assert reminder.user_phone == user.phone_number
    # A hora agendada não pode estar no período de silêncio
    assert not (reminder.scheduled_at.hour >= 22 or reminder.scheduled_at.hour < 8)

def test_reminder_message_is_gentle_and_unshaming():
    """Garante que a mensagem de lembrete não contenha culpa e ofereça opções de ajuste."""
    msg = NeuroScheduler.format_reminder_message("Escrever introdução", 5)
    assert "Sem pressa" in msg
    assert "✅" in msg
    assert "dividir em etapas menores" in msg

# -------------------------------------------------------------
# 3. Testes do Modelo de Pagamento Único (Sem Vínculo Contínuo)
# -------------------------------------------------------------
def test_license_manager_accepts_one_time_payment():
    """Valida a ativação da licença vitalícia para compras avulsas."""
    manager = LicenseManager()
    payload = PaymentVerificationRequest(
        phone_number="+5511988887777",
        customer_name="Mariana TDAH",
        payment_id="PAY_UNIQUE_12345",
        amount=97.00,
        provider="mercadopago",
        is_recurring=False # Pagamento único garantido
    )

    user = manager.process_one_time_payment(payload)
    assert user.is_lifetime_active is True
    assert user.has_recurring_subscription is False
    assert manager.is_user_authorized("+5511988887777") is True

def test_license_manager_rejects_recurring_subscription():
    """Garante que tentativas de cobrança por assinatura contínua sejam rejeitadas."""
    manager = LicenseManager()
    payload = PaymentVerificationRequest(
        phone_number="+5511988887777",
        payment_id="SUB_ERRADA",
        amount=29.90,
        is_recurring=True # Violação da regra de pagamento único
    )

    with pytest.raises(ValueError, match="Apenas pagamentos únicos sem assinatura são aceitos"):
        manager.process_one_time_payment(payload)

# -------------------------------------------------------------
# 4. Testes de Integração com Endpoints da API
# -------------------------------------------------------------
def test_unregistered_user_receives_checkout_invitation():
    """Usuário não pago recebe convite de pagamento único ao mandar mensagem no WhatsApp."""
    response = client.post(
        "/webhook/twilio",
        data={
            "From": "whatsapp:+5521999990000",
            "Body": "Olá, quero ajuda com meu trabalho",
            "ProfileName": "Visitante"
        }
    )
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    assert "Pagamento Único" in response.text
    assert "vitalício" in response.text

def test_payment_webhook_activates_and_authorizes_user():
    """Ao receber o webhook de pagamento do Mercado Pago, ativa o usuário e responde via WhatsApp."""
    payment_data = {
        "phone_number": "+5511977776666",
        "customer_name": "Carlos Silva",
        "payment_id": "MP_PIX_999",
        "amount": 97.0,
        "provider": "mercadopago",
        "is_recurring": False
    }

    # Dispara webhook de pagamento
    pay_res = client.post("/webhook/payment", json=payment_data)
    assert pay_res.status_code == 200
    assert pay_res.json()["has_recurring_subscription"] is False

    # Agora o usuário envia mensagem no WhatsApp e deve ser atendido pelo copiloto
    wa_res = client.post(
        "/webhook/twilio",
        data={
            "From": "whatsapp:+5511977776666",
            "Body": "Preciso organizar meu quarto e estou com muita preguiça",
            "ProfileName": "Carlos"
        }
    )
    assert wa_res.status_code == 200
    assert "Passo 1" in wa_res.text
    assert "FocoGentil" not in wa_res.text or "Passo" in wa_res.text

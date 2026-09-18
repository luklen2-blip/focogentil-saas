from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class EnergyLevel(str, Enum):
    LOW = "baixa"
    MEDIUM = "media"
    HIGH = "alta"

class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SNOOZED = "snoozed"
    ABANDONED_WITHOUT_GUILT = "abandoned_without_guilt"

class MicroTask(BaseModel):
    step_number: int = Field(..., description="Ordem sequencial da etapa")
    title: str = Field(..., description="Ação atômica de baixa fricção")
    duration_minutes: int = Field(..., description="Duração estimada (2 a 15 min)")
    why_it_helps: Optional[str] = Field(None, description="Explicação motivacional")
    urgency_score: int = Field(3, ge=1, le=5, description="1 (menor) a 5 (mais urgente)")
    status: TaskStatus = TaskStatus.PENDING
    scheduled_for: Optional[datetime] = None

class ProjectBreakdown(BaseModel):
    project_title: str
    recommended_first_step: str
    energy_level: EnergyLevel = EnergyLevel.MEDIUM
    micro_tasks: List[MicroTask]
    gentle_tip: str

class UserProfile(BaseModel):
    phone_number: str = Field(..., description="Formato internacional WhatsApp, ex: +5511999998888")
    name: Optional[str] = None
    is_lifetime_active: bool = Field(False, description="Acesso vitalício por pagamento único garantido")
    paid_at: Optional[datetime] = None
    payment_provider: Optional[str] = None
    payment_reference: Optional[str] = None
    has_recurring_subscription: bool = Field(False, description="DEVE ser False para cumprir a regra de pagamento único")
    current_energy_level: EnergyLevel = EnergyLevel.MEDIUM
    quiet_hours_start: int = 22 # Silêncio noturno (22h)
    quiet_hours_end: int = 8   # Silêncio matutino (8h)

class ReminderRecord(BaseModel):
    id: Optional[str] = None
    user_phone: str
    task_title: str
    duration_minutes: int
    scheduled_at: datetime
    is_dispatched: bool = False
    status: str = "pending"

class TwilioInboundMessage(BaseModel):
    From: str = Field(..., description="Remetente no formato whatsapp:+5511999998888")
    To: str = Field(..., description="Número Twilio WhatsApp")
    Body: Optional[str] = Field(None, description="Texto da mensagem enviada")
    MediaUrl0: Optional[str] = Field(None, description="URL do áudio se for nota de voz")
    ProfileName: Optional[str] = Field(None, description="Nome do perfil do usuário no WhatsApp")

class PaymentVerificationRequest(BaseModel):
    phone_number: str
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    payment_id: str
    amount: float
    currency: str = "BRL"
    provider: str = "mercadopago" # ou stripe
    is_recurring: bool = False # Valida que NÃO há cobrança contínua

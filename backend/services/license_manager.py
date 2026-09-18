from datetime import datetime
from typing import Dict, Optional
from models import UserProfile, PaymentVerificationRequest

class LicenseManager:
    """
    Gerenciador de licenças focado no modelo de PAGAMENTO ÚNICO (Lifetime Access).
    Garante ausência de mensalidades ou vínculos contínuos após a compra.
    """
    def __init__(self):
        # Armazenamento em memória (pode ser mapeado para Postgres/Supabase/SQLite)
        self.users: Dict[str, UserProfile] = {}

    def normalize_phone(self, phone: str) -> str:
        """Limpa e formata o número de telefone internacional (ex: whatsapp:+5511999998888 -> +5511999998888)."""
        clean = phone.replace("whatsapp:", "").replace(" ", "").replace("-", "")
        if not clean.startswith("+"):
            clean = "+" + clean
        return clean

    def register_or_get_user(self, raw_phone: str, name: Optional[str] = None) -> UserProfile:
        phone = self.normalize_phone(raw_phone)
        if phone not in self.users:
            self.users[phone] = UserProfile(
                phone_number=phone,
                name=name,
                is_lifetime_active=False,
                has_recurring_subscription=False
            )
        return self.users[phone]

    def process_one_time_payment(self, payload: PaymentVerificationRequest) -> UserProfile:
        """
        Processa o webhook de pagamento único (Mercado Pago / Stripe).
        Valida que NÃO se trata de uma assinatura e ativa o acesso vitalício.
        """
        if payload.is_recurring:
            raise ValueError("Erro de negócio: Apenas pagamentos únicos sem assinatura são aceitos neste plano.")

        phone = self.normalize_phone(payload.phone_number)
        user = self.users.get(phone)
        if not user:
            user = UserProfile(
                phone_number=phone,
                name=payload.customer_name,
                is_lifetime_active=True,
                paid_at=datetime.now(),
                payment_provider=payload.provider,
                payment_reference=payload.payment_id,
                has_recurring_subscription=False
            )
            self.users[phone] = user
        else:
            user.is_lifetime_active = True
            user.paid_at = datetime.now()
            user.payment_provider = payload.provider
            user.payment_reference = payload.payment_id
            user.has_recurring_subscription = False
            if payload.customer_name and not user.name:
                user.name = payload.customer_name

        return user

    def is_user_authorized(self, raw_phone: str) -> bool:
        phone = self.normalize_phone(raw_phone)
        user = self.users.get(phone)
        if not user:
            return False
        return user.is_lifetime_active and not user.has_recurring_subscription

    @staticmethod
    def get_checkout_invitation_message(checkout_url: str = "https://checkout.seudominio.com/copiloto-vitalicio") -> str:
        """Mensagem acolhedora enviada a novos usuários explicando o pagamento único sem pegadinhas."""
        return (
            "👋 Olá! Seja muito bem-vindo ao *FocoGentil* 🧠✨\n\n"
            "Eu sou seu copiloto de produtividade feito especialmente para mentes neurodivergentes.\n\n"
            "💎 *Modelo de Pagamento Único:* Aqui você não fica preso a assinaturas mensais!\n"
            "Com um único pagamento, você garante acesso vitalício a todas as funções de decomposição e lembretes.\n\n"
            f"👉 Garanta seu acesso único aqui: {checkout_url}\n\n"
            "_Assim que seu pagamento for confirmado, este chat será ativado automaticamente._"
        )

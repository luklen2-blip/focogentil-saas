import os
from typing import Optional

class TwilioWhatsAppService:
    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        from_number: Optional[str] = None
    ):
        self.account_sid = account_sid or os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = auth_token or os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = from_number or os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        self.client = None

        if self.account_sid and self.auth_token:
            try:
                from twilio.rest import Client
                self.client = Client(self.account_sid, self.auth_token)
            except ImportError:
                print("[Aviso] Biblioteca 'twilio' não instalada. Executando em modo simulação.")

    def send_whatsapp_message(self, to_phone: str, body: str) -> bool:
        """
        Envia uma mensagem de WhatsApp via Twilio.
        Garante que o destinatário comece com o prefixo 'whatsapp:'.
        """
        target = to_phone if to_phone.startswith("whatsapp:") else f"whatsapp:{to_phone}"
        sender = self.from_number if self.from_number.startswith("whatsapp:") else f"whatsapp:{self.from_number}"

        if self.client:
            try:
                msg = self.client.messages.create(
                    from_=sender,
                    to=target,
                    body=body
                )
                print(f"[Twilio] Mensagem enviada com sucesso! SID: {msg.sid}")
                return True
            except Exception as e:
                print(f"[Erro Twilio] Falha ao enviar para {target}: {e}")
                return False
        else:
            print(f"[Twilio Simulado] De: {sender} -> Para: {target}\nConteúdo:\n{body}\n---")
            return True

    @staticmethod
    def build_twiml_response(body_text: str) -> str:
        """Retorna uma resposta TwiML pura para responder instantaneamente no webhook da Twilio."""
        escaped = (
            body_text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<Response><Message>{escaped}</Message></Response>'
        )

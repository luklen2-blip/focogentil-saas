import json
import os
from typing import Optional
from models import ProjectBreakdown, EnergyLevel, MicroTask
from prompts.neuro_prompts import (
    SYSTEM_PROMPT_NEURO_COPILOT,
    DECOMPOSITION_PROMPT_TEMPLATE,
    PRIORITIZATION_PROMPT_TEMPLATE,
    ANTI_GUILT_REMINDER_PROMPT_TEMPLATE
)

# Suporte flexível: Google Gemini ou fallback determinístico de alta qualidade
try:
    from google import genai
    from google.genai import types
    HAS_GEMINI_SDK = True
except ImportError:
    HAS_GEMINI_SDK = False

class NeuroDecompositionEngine:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.client = None
        if HAS_GEMINI_SDK and self.api_key:
            self.client = genai.Client(api_key=self.api_key)

    def decompose_project(
        self,
        project_description: str,
        energy_level: EnergyLevel = EnergyLevel.MEDIUM,
        time_limit: Optional[str] = None
    ) -> ProjectBreakdown:
        """
        Divide um projeto ou tarefa paralisante em microetapas de baixa fricção.
        """
        prompt = DECOMPOSITION_PROMPT_TEMPLATE.format(
            user_input=project_description,
            energy_level=energy_level.value,
            time_limit=time_limit or "Livre / No seu ritmo"
        )

        if self.client:
            try:
                response = self.client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT_NEURO_COPILOT,
                        response_mime_type="application/json",
                        temperature=0.4,
                    )
                )
                data = json.loads(response.text)
                return ProjectBreakdown(**data)
            except Exception as e:
                print(f"[Aviso] Falha na chamada da LLM Gemini ({e}). Usando fallback inteligente.")

        # Fallback determinístico inteligente para testes locais sem chave de API
        return self._fallback_decomposition(project_description, energy_level)

    def _fallback_decomposition(self, description: str, energy: EnergyLevel) -> ProjectBreakdown:
        """Garante funcionamento imediato e confiável mesmo sem API configurada."""
        base_title = description.strip().capitalize()
        if len(base_title) > 40:
            base_title = base_title[:40] + "..."

        micro_tasks = [
            MicroTask(
                step_number=1,
                title=f"Preparar o ambiente e abrir o arquivo/site de '{base_title}'",
                duration_minutes=3,
                why_it_helps="Passo de ignição com fricção zero para quebrar a inércia mental",
                urgency_score=5
            ),
            MicroTask(
                step_number=2,
                title="Escrever 3 tópicos simples ou ler a primeira instrução",
                duration_minutes=7,
                why_it_helps="Quebra a inércia inicial com esforço mínimo",
                urgency_score=4
            ),
            MicroTask(
                step_number=3,
                title="Executar o ponto principal por 10 minutos (coloque um cronômetro)",
                duration_minutes=10,
                why_it_helps="Foco atômico com tempo pré-definido contra cegueira temporal",
                urgency_score=3
            ),
            MicroTask(
                step_number=4,
                title="Salvar o progresso e fazer uma pausa de 5 min (água/alongamento)",
                duration_minutes=5,
                why_it_helps="Recarrega a bateria cognitiva e previne esgotamento",
                urgency_score=2
            )
        ]

        return ProjectBreakdown(
            project_title=base_title,
            recommended_first_step=micro_tasks[0].title,
            energy_level=energy,
            micro_tasks=micro_tasks,
            gentle_tip="Lembre-se: feito é melhor que perfeito. Vamos focar apenas no Passo 1!"
        )

    def format_whatsapp_response(self, breakdown: ProjectBreakdown) -> str:
        """
        Formata a resposta no padrão amigável para WhatsApp:
        - Curta, espaçada, visual e acolhedora.
        - Apresenta o passo de ignição e opções numéricas diretas.
        """
        lines = [
            f"🌱 *Projeto:* {breakdown.project_title}",
            f"🔋 *Energia:* {breakdown.energy_level.value.upper()}",
            "",
            "Quebrei em passos super pequenos para o seu cérebro não travar:",
            ""
        ]

        for task in breakdown.micro_tasks:
            icon = "⚡" if task.step_number == 1 else "🔹"
            lines.append(f"{icon} *Passo {task.step_number}* (⏱️ {task.duration_minutes} min)")
            lines.append(f"   _{task.title}_")
            lines.append("")

        lines.append(f"💡 *Dica acolhedora:* {breakdown.gentle_tip}")
        lines.append("")
        lines.append("👇 *O que vamos fazer agora?*")
        lines.append("Responda apenas com o número:")
        lines.append("*1* - Iniciei o Passo 1 (agendar lembrete)")
        lines.append("*2* - Ficou difícil: dividir em etapas menores")
        lines.append("*3* - Bateria fraca: adiar para depois")

        return "\n".join(lines)

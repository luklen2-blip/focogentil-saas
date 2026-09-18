from datetime import datetime, timedelta
from typing import List, Optional
from models import ReminderRecord, MicroTask, UserProfile

class NeuroScheduler:
    def __init__(self):
        # Fila persistente ou em memória de lembretes
        self.reminders_queue: List[ReminderRecord] = []

    def schedule_micro_task(
        self,
        user: UserProfile,
        task: MicroTask,
        delay_minutes: Optional[int] = None
    ) -> ReminderRecord:
        """
        Agenda um lembrete gentil para uma microtarefa respeitando os horários de silêncio do usuário.
        """
        minutes_to_add = delay_minutes if delay_minutes is not None else task.duration_minutes
        target_time = datetime.now() + timedelta(minutes=minutes_to_add)

        # Ajuste para horário de silêncio (ex: se cair entre 22h e 8h, agenda para as 09:00 do dia seguinte)
        if target_time.hour >= user.quiet_hours_start:
            # Passa para amanhã após quiet_hours_end
            target_time = (target_time + timedelta(days=1)).replace(
                hour=user.quiet_hours_end + 1, minute=0, second=0
            )
        elif target_time.hour < user.quiet_hours_end:
            target_time = target_time.replace(
                hour=user.quiet_hours_end + 1, minute=0, second=0
            )

        reminder = ReminderRecord(
            id=f"rem_{len(self.reminders_queue) + 1}_{int(datetime.now().timestamp())}",
            user_phone=user.phone_number,
            task_title=task.title,
            duration_minutes=task.duration_minutes,
            scheduled_at=target_time,
            is_dispatched=False,
            status="pending"
        )
        self.reminders_queue.append(reminder)
        return reminder

    def get_pending_due_reminders(self) -> List[ReminderRecord]:
        """Retorna todos os lembretes que atingiram o horário programado e ainda não foram disparados."""
        now = datetime.now()
        due = [r for r in self.reminders_queue if not r.is_dispatched and r.scheduled_at <= now]
        return due

    def mark_as_dispatched(self, reminder_id: str):
        for r in self.reminders_queue:
            if r.id == reminder_id:
                r.is_dispatched = True
                r.status = "dispatched"
                break

    @staticmethod
    def format_reminder_message(task_title: str, duration_minutes: int) -> str:
        """Cria mensagem de lembrete focada em 'body doubling' gentil e livre de vergonha."""
        return (
            f"👋 Olá! Passando para ver como você está com:\n"
            f"🔹 *{task_title}* (~{duration_minutes} min)\n\n"
            f"Sem pressa nem cobrança! Como foi?\n"
            f"*1* - ✅ Consegui fazer!\n"
            f"*2* - 🤏 Travei: quero dividir em etapas menores\n"
            f"*3* - ⏸️ Adiar 30 minutos"
        )

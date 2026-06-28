from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from src.config import get_settings

logger = logging.getLogger(__name__)


def send_verification_email(email: str, verification_url: str) -> bool:
    settings = get_settings()
    subject = "Verify your email"
    body = (
        "Welcome!\n\n"
        "Please verify your email address by opening this link:\n"
        f"{verification_url}\n\n"
        "If you did not create this account, you can ignore this email."
    )

    if not settings.smtp_host:
        print(f"Email verification link for {email}: {verification_url}")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email or settings.smtp_username or "noreply@example.com"
    message["To"] = email
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return True
    except Exception as exc:
        logger.warning("Could not send verification email to %s: %s", email, exc)
        print(f"Email verification link for {email}: {verification_url}")
        return False

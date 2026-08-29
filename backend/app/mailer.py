"""Tiny mailer.

If BUDDY_SMTP_HOST is set, sends real email over SMTP.
Otherwise prints the message to the console — handy for local dev so the
flow is observable without any real SMTP config.

Env vars (all optional):
  BUDDY_SMTP_HOST       e.g. smtp.gmail.com
  BUDDY_SMTP_PORT       e.g. 587 (default 587)
  BUDDY_SMTP_USER       login username
  BUDDY_SMTP_PASSWORD   login password / app password
  BUDDY_SMTP_FROM       From: header (default "Buddy <noreply@buddy.local>")
  BUDDY_SMTP_TLS        "1" to use STARTTLS (default), "0" to disable
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage


log = logging.getLogger("buddy.mailer")


def send_email(to: str, subject: str, body: str) -> None:
    host = os.getenv("BUDDY_SMTP_HOST")
    sender = os.getenv("BUDDY_SMTP_FROM", "Buddy <noreply@buddy.local>")

    if not host:
        # Dev fallback: log it. NEVER do this with real email content in prod.
        log.warning(
            "[mailer] SMTP not configured, printing email to console.\n"
            "--- email ---\nTo: %s\nFrom: %s\nSubject: %s\n\n%s\n--- end ---",
            to, sender, subject, body,
        )
        return

    port = int(os.getenv("BUDDY_SMTP_PORT", "587"))
    user = os.getenv("BUDDY_SMTP_USER")
    password = os.getenv("BUDDY_SMTP_PASSWORD")
    use_tls = os.getenv("BUDDY_SMTP_TLS", "1") != "0"

    msg = EmailMessage()
    msg["To"] = to
    msg["From"] = sender
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.ehlo()
            if use_tls:
                smtp.starttls()
                smtp.ehlo()
            if user and password:
                smtp.login(user, password)
            smtp.send_message(msg)
    except Exception:
        log.exception("[mailer] Failed to send email to %s", to)
        # Don't re-raise — the caller has already updated the password.

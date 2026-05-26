from __future__ import annotations

import logging

import resend

logger = logging.getLogger(__name__)

RESET_EMAIL_SUBJECT = "Your Humber Event Hub password reset code"
FROM_ADDRESS = "noreply@humber-event-hub.com"


class EmailService:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def send_password_reset(self, to_email: str, raw_token: str) -> None:
        """Send a password reset email with the raw token and suppress provider errors."""
        resend.api_key = self._api_key
        try:
            resend.Emails.send(
                {
                    "from": FROM_ADDRESS,
                    "to": [to_email],
                    "subject": RESET_EMAIL_SUBJECT,
                    "text": (
                        "Your password reset token for Humber Event Hub:\n\n"
                        f"{raw_token}\n\n"
                        "This token expires in 10 minutes. Do not share it with anyone."
                    ),
                }
            )
        except Exception as exc:  # pragma: no cover - defensive logging path
            logger.error(
                "Failed to send password reset email to %s: %s",
                to_email,
                exc,
            )

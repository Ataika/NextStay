import json
import urllib.error
import urllib.request
from email.message import EmailMessage

import aiosmtplib
from app.core.config import (
    BREVO_API_KEY,
    BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME,
    FRONTEND_URL,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)
from app.core.logging import get_logger

logger = get_logger(__name__)


async def send_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP not configured. Would send to %s: %s", to_email, subject)
        return False

    try:
        message = EmailMessage()
        message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject

        if html_body:
            message.set_content(body)
            message.add_alternative(html_body, subtype="html")
        else:
            message.set_content(body)

        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
        )

        logger.info("Email sent to %s.", to_email)
        return True
    except Exception as e:  # noqa: BLE001
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


def send_otp_email(to_email: str, otp: str) -> bool:
    """Send OTP email via Brevo transactional API."""
    if not BREVO_API_KEY:
        logger.error("BREVO_API_KEY is missing. Cannot send OTP to %s.", to_email)
        return False
    if not BREVO_SENDER_EMAIL:
        logger.error("BREVO_SENDER_EMAIL is missing. Cannot send OTP to %s.", to_email)
        return False

    payload = {
        "to": [{"email": to_email}],
        "sender": {"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
        "subject": "Your One-Time Password",
        "htmlContent": f"<p>Your OTP is <b>{otp}</b>. It expires in 5 minutes.</p>",
    }

    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": BREVO_API_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if 200 <= response.status < 300:
                return True
            logger.warning("Brevo non-success status %d for %s.", response.status, to_email)
            return False
    except urllib.error.HTTPError as err:
        details = err.read().decode("utf-8", errors="ignore")
        logger.error("Brevo HTTP error for %s: %d %s", to_email, err.code, details)
        return False
    except Exception as err:  # noqa: BLE001
        logger.error("Brevo send failed for %s: %s", to_email, err)
        return False


async def send_booking_confirmation_to_guest(
    guest_email: str,
    guest_name: str,
    room_number: str,
    check_in: str,
    check_out: str,
    total_amount: float,
    guest_token: str,
) -> bool:
    guest_link = f"{FRONTEND_URL}/guest/{guest_token}"
    subject = "Booking Confirmed - NextStay"
    body = f"""
Hello {guest_name},

Your booking has been confirmed!

Room: {room_number}
Check-in: {check_in}
Check-out: {check_out}
Total: ${total_amount:.2f}

Access your room: {guest_link}

Thank you for choosing NextStay!
"""
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #3b82f6; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background-color: #f9fafb; }}
        .button {{
            display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white;
            text-decoration: none; border-radius: 5px; margin-top: 20px;
        }}
        .details {{ background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>Booking Confirmed!</h1></div>
        <div class="content">
            <p>Hello {guest_name},</p>
            <p>Your booking has been confirmed!</p>
            <div class="details">
                <p><strong>Room:</strong> {room_number}</p>
                <p><strong>Check-in:</strong> {check_in}</p>
                <p><strong>Check-out:</strong> {check_out}</p>
                <p><strong>Total:</strong> ${total_amount:.2f}</p>
            </div>
            <a href="{guest_link}" class="button">Access Your Room</a>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
                Thank you for choosing NextStay!
            </p>
        </div>
    </div>
</body>
</html>
"""
    return await send_email(guest_email, subject, body, html_body)


async def send_booking_notification_to_owner(
    owner_email: str,
    guest_name: str,
    guest_email: str,
    room_number: str,
    check_in: str,
    check_out: str,
    total_amount: float,
) -> bool:
    subject = "New Booking - NextStay"
    body = f"""
New booking received!

Guest: {guest_name} ({guest_email})
Room: {room_number}
Check-in: {check_in}
Check-out: {check_out}
Total: ${total_amount:.2f}

Please check your dashboard for details.
"""
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background-color: #f9fafb; }}
        .details {{ background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>New Booking Received</h1></div>
        <div class="content">
            <p>A new booking has been confirmed!</p>
            <div class="details">
                <p><strong>Guest:</strong> {guest_name}</p>
                <p><strong>Email:</strong> {guest_email}</p>
                <p><strong>Room:</strong> {room_number}</p>
                <p><strong>Check-in:</strong> {check_in}</p>
                <p><strong>Check-out:</strong> {check_out}</p>
                <p><strong>Total:</strong> ${total_amount:.2f}</p>
            </div>
            <p>Please check your dashboard for details.</p>
        </div>
    </div>
</body>
</html>
"""
    return await send_email(owner_email, subject, body, html_body)

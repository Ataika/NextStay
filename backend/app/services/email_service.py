import aiosmtplib
from email.message import EmailMessage
from typing import Optional
import os
from app.core.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    FRONTEND_URL
)


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None
) -> bool:
    """
    Отправка email через SMTP
    
    Args:
        to_email: Email получателя
        subject: Тема письма
        body: Текст письма (plain text)
        html_body: HTML версия письма (опционально)
    
    Returns:
        True если отправлено успешно, False иначе
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[EMAIL] SMTP not configured. Would send to {to_email}: {subject}")
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
        
        print(f"[EMAIL] Sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to_email}: {str(e)}")
        return False


async def send_booking_confirmation_to_guest(
    guest_email: str,
    guest_name: str,
    room_number: str,
    check_in: str,
    check_out: str,
    total_amount: float,
    guest_token: str
) -> bool:
    """Отправка подтверждения бронирования гостю"""
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
        .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }}
        .details {{ background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Booking Confirmed!</h1>
        </div>
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
    total_amount: float
) -> bool:
    """Отправка уведомления о новом бронировании владельцу"""
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
        <div class="header">
            <h1>New Booking Received</h1>
        </div>
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

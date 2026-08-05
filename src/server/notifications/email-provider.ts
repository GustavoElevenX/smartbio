export interface EmailMessage { to: string; subject: string; html: string; }
export interface EmailDeliveryResult { provider: string; messageId?: string; }
export interface EmailProvider { send(message: EmailMessage): Promise<EmailDeliveryResult>; }
export class ConsoleEmailProvider implements EmailProvider { async send(message: EmailMessage) { if (process.env.NODE_ENV !== "test") console.info("notification_email_development", { subject: message.subject, htmlLength: message.html.length }); return { provider: "console" }; } }

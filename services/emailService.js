    // emailService.js
    import { Resend } from 'resend';
    import dotenv from 'dotenv';

    dotenv.config();

    const resend = new Resend(process.env.RESEND_API_KEY);

    async function sendEmail(to, subject, html) {
    try {
        const data = await resend.emails.send({
        from: 'COFFEE HOUSE <onboarding@resend.dev>', 
        // ⚠️ Si luego verificas tu dominio, cámbialo a algo como:
        // from: 'COFFEE HOUSE <no-reply@tudominio.com>'
        to,
        subject,
        html,
        });
        console.log("📧 Correo enviado:", data.id || data);
        return true;
    } catch (error) {
        console.error("❌ Error al enviar correo:", error.message);
        return false;
    }
    }

    export { sendEmail };

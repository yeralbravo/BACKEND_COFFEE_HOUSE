import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.EMAIL_PORT) || 587;

// Configuración del transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465, // true solo si usas puerto 465 (SSL)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false'
    }
});

// Verificar la conexión al iniciar
transporter.verify()
    .then(() => {
        console.log('✅ Servidor de correo listo para enviar emails.');
    })
    .catch(err => {
        console.error('❌ Error al verificar conexión SMTP:', err.message);
    });

// Función para enviar correos
export async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"COFFEE HOUSE" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text: html.replace(/<[^>]*>/g, '') // versión texto plano
        });
        console.log(`📧 Correo enviado: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error("❌ Error al enviar el correo:", error.message);
        return false;
    }
}

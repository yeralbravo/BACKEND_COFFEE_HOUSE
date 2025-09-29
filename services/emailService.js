import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // O true si el puerto es 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"COFFEE HOUSE" <${process.env.EMAIL_USER}>`,
            to, // destinatario
            subject, // asunto del correo
            html, // contenido del correo en HTML
        });
        console.log("Correo enviado: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error al enviar el correo:", error);
        return false;
    }
}

export { sendEmail };
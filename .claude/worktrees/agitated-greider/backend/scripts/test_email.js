import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('\n=== Configuración SMTP ===');
console.log(`Host: ${process.env.EMAIL_HOST}`);
console.log(`Puerto: ${process.env.EMAIL_PORT}`);
console.log(`Secure: ${process.env.EMAIL_SECURE}`);
console.log(`Usuario: ${process.env.EMAIL_USER}`);
console.log(`Password: ${process.env.EMAIL_PASSWORD ? '***' + process.env.EMAIL_PASSWORD.slice(-3) : 'NO CONFIGURADA'}`);
console.log('========================\n');

// Configuración del transportador
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
    debug: true, // Habilitar logs de depuración
    logger: true, // Habilitar logger
});

async function testConnection() {
    console.log('🔍 Verificando conexión SMTP...\n');
    
    try {
        // Verificar conexión
        await transporter.verify();
        console.log('✅ Conexión SMTP exitosa\n');
        
        // Enviar email de prueba
        console.log('📧 Enviando email de prueba...\n');
        
        const info = await transporter.sendMail({
            from: `"IA RPJ" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Enviar a la misma cuenta
            subject: 'Prueba de Configuración SMTP',
            text: 'Este es un email de prueba para verificar la configuración SMTP.',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #667eea;">Prueba de Configuración SMTP</h2>
                    <p>Este es un email de prueba para verificar que el servicio de correo está funcionando correctamente.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">
                        Configuración:<br>
                        Host: ${process.env.EMAIL_HOST}<br>
                        Puerto: ${process.env.EMAIL_PORT}<br>
                        Secure: ${process.env.EMAIL_SECURE}<br>
                        Fecha: ${new Date().toLocaleString('es-ES')}
                    </p>
                </div>
            `,
        });
        
        console.log('✅ Email enviado exitosamente');
        console.log(`📬 Message ID: ${info.messageId}`);
        console.log(`📨 Response: ${info.response}\n`);
        
    } catch (error) {
        console.error('❌ Error en la prueba de email:\n');
        console.error(`Tipo: ${error.name}`);
        console.error(`Mensaje: ${error.message}`);
        
        if (error.code) {
            console.error(`Código: ${error.code}`);
        }
        
        if (error.command) {
            console.error(`Comando: ${error.command}`);
        }
        
        if (error.responseCode) {
            console.error(`Código de respuesta: ${error.responseCode}`);
        }
        
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
        
        console.error('\n💡 Posibles soluciones:');
        console.error('1. Verifica que el puerto sea correcto (465 con secure=true, 587 con secure=false)');
        console.error('2. Verifica las credenciales en el archivo .env');
        console.error('3. Verifica que el servidor SMTP permita conexiones desde esta IP');
        console.error('4. Verifica que no haya firewall bloqueando el puerto');
        console.error('5. Si usas puerto 465, cambia EMAIL_SECURE="true"');
        console.error('6. Si usas puerto 587, cambia EMAIL_SECURE="false"');
    }
}

// Ejecutar prueba
testConnection().then(() => {
    console.log('\n✨ Prueba completada\n');
    process.exit(0);
}).catch(err => {
    console.error('\n💥 Error fatal:', err);
    process.exit(1);
});

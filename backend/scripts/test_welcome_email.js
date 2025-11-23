import { sendWelcomeEmail } from '../src/services/emailService.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function testWelcomeEmail() {
    console.log('\n🧪 Test de Email de Bienvenida\n');
    console.log('Este script enviará un email de prueba con las credenciales de un usuario ficticio.\n');
    
    const email = await question('📧 Ingresa el email destinatario (o Enter para usar noreply@ia.rpj.es): ');
    const destinatario = email.trim() || 'noreply@ia.rpj.es';
    
    console.log(`\n📨 Enviando email de prueba a: ${destinatario}\n`);
    
    const testData = {
        nombre: 'Usuario de Prueba',
        email: destinatario,
        nombreUsuario: 'usuario.prueba',
        password: 'PruebaTemp123!',
        loginUrl: 'https://ia.rpj.es/auth/login'
    };
    
    try {
        const result = await sendWelcomeEmail(testData);
        
        console.log('✅ Email enviado exitosamente!\n');
        console.log('📋 Detalles:');
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   Destinatario: ${destinatario}`);
        console.log(`   Nombre: ${testData.nombre}`);
        console.log(`   Usuario: ${testData.nombreUsuario}`);
        console.log(`   Contraseña: ${testData.password}`);
        
        console.log('\n📥 Revisa tu bandeja de entrada y la carpeta de SPAM');
        console.log('💡 Si no recibes el email en 2-3 minutos, puede ser:');
        console.log('   1. El email está en SPAM/Correo no deseado');
        console.log('   2. Problemas de DNS (SPF/DKIM/DMARC)');
        console.log('   3. El servidor de destino está rechazando los emails');
        console.log('   4. Hay límites de envío configurados en Plesk');
        
    } catch (error) {
        console.error('\n❌ Error al enviar email:', error.message);
        console.error('\n📋 Detalles del error:');
        console.error(error);
    }
    
    rl.close();
}

testWelcomeEmail().then(() => {
    console.log('\n✨ Test completado\n');
    process.exit(0);
}).catch(err => {
    console.error('\n💥 Error fatal:', err);
    process.exit(1);
});

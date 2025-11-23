import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'ia.rpj.es',
    port: 465,
    secure: true,
    auth: {
        user: 'noreply@ia.rpj.es',
        pass: 'Servidor2025',
    },
    debug: true,
    logger: true,
});

async function testEmail() {
    try {
        console.log('\n🔍 Probando conexión y envío...\n');
        
        await transporter.verify();
        console.log('✅ Conexión verificada\n');
        
        const info = await transporter.sendMail({
            from: '"IA RPJ Test" <noreply@ia.rpj.es>',
            to: 'raul@rpj.es',
            subject: 'Test Directo - ' + new Date().toLocaleTimeString(),
            text: 'Este es un email de prueba enviado directamente.',
            html: '<p>Este es un email de prueba enviado directamente.</p><p>Hora: ' + new Date().toLocaleString() + '</p>',
        });
        
        console.log('✅ Email enviado');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log('Accepted:', info.accepted);
        console.log('Rejected:', info.rejected);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testEmail().then(() => process.exit(0));

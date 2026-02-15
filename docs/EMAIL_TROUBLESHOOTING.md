# Troubleshooting: Emails no se reciben

## Estado actual

✅ **Aplicación funcionando correctamente**
- El código de envío de emails está correcto
- La conexión SMTP con el servidor funciona (puerto 465, SSL)
- Los emails se autentican y se ponen en cola correctamente
- Logs confirman: `250 2.0.0 Ok: queued as XXXXXXX`

❌ **Problema: Los emails no llegan al destinatario**
- Los emails se quedan en la cola del servidor
- Posiblemente están siendo rechazados por servidores receptores
- Causa probable: Falta configuración DNS (SPF/DKIM)

## Verificaciones técnicas realizadas

### 1. Test de conexión SMTP
```bash
# Resultado: ✅ Exitoso
Host: ia.rpj.es
Puerto: 465
Secure: true
Usuario: noreply@ia.rpj.es
Autenticación: Exitosa (235 2.7.0 Authentication successful)
```

### 2. Test de envío de email
```bash
# Resultado: ✅ Email aceptado y en cola
Message ID: <030a43d0-9ea2-79a2-b90e-c3e07f07c698@ia.rpj.es>
Response: 250 2.0.0 Ok: queued as 2355D1C4505
Accepted: [ 'raul@rpj.es' ]
Rejected: []
```

### 3. Logs de aplicación
```bash
# Múltiples emails enviados exitosamente
✅ Email enviado: <8bb80d93-dab3-c7d1-aabe-6cb3c60d5a86@ia.rpj.es>
✅ Email enviado: <1a608743-3c53-ff09-5267-9236723bb0e4@ia.rpj.es>
✅ Email enviado: <3601fbd9-33d5-6c21-ea58-4560287bf6a1@ia.rpj.es>
```

## Solución: Configuración DNS en Plesk

### Paso 1: Acceder a la configuración DNS

1. Entrar a **Plesk** (https://ia.rpj.es:8443 o el panel que uses)
2. Ir a **Sitios web y dominios**
3. Seleccionar el dominio **ia.rpj.es**
4. Click en **Configuración DNS**

### Paso 2: Configurar registro SPF

**¿Qué es SPF?** Indica qué servidores pueden enviar emails en nombre de tu dominio.

**Añadir registro TXT:**
```
Nombre: @ (o dejar vacío)
Tipo: TXT
Valor: v=spf1 a mx ip4:217.154.99.32 ~all
TTL: 3600
```

**Explicación:**
- `v=spf1` - Versión de SPF
- `a` - Permite enviar desde la IP A del dominio
- `mx` - Permite enviar desde los servidores MX
- `ip4:217.154.99.32` - IP explícita del servidor
- `~all` - Soft fail (marca como spam si no coincide)

### Paso 3: Configurar DKIM

**¿Qué es DKIM?** Firma criptográfica que verifica que el email no fue alterado.

1. En Plesk, ir a **Mail Settings** (Configuración de correo)
2. Buscar **DKIM spam protection**
3. Hacer click en **Enable DKIM**
4. Guardar cambios
5. Plesk generará automáticamente:
   - Claves privada/pública
   - Registro DNS necesario

**Verificar registro DKIM generado:**
- Aparecerá en la configuración DNS automáticamente
- Formato: `default._domainkey.ia.rpj.es TXT "v=DKIM1; ..."`

### Paso 4: Verificar registros MX

Asegurarse de que existen estos registros:

```
Tipo: MX
Prioridad: 10
Valor: ia.rpj.es.
```

Si usas otro servidor de correo (Gmail, Outlook), actualizar el MX apropiadamente.

### Paso 5: Configurar DMARC (Opcional pero recomendado)

**¿Qué es DMARC?** Política que indica qué hacer si SPF/DKIM fallan.

**Añadir registro TXT:**
```
Nombre: _dmarc
Tipo: TXT
Valor: v=DMARC1; p=quarantine; rua=mailto:noreply@ia.rpj.es
TTL: 3600
```

**Explicación:**
- `p=quarantine` - Marca como spam si falla SPF/DKIM
- `rua=mailto:...` - Email para recibir reportes

### Paso 6: Verificar la configuración

**Herramientas online:**

1. **MXToolbox - Blacklist Check**
   - URL: https://mxtoolbox.com/blacklists.aspx
   - Ingresar: `217.154.99.32`
   - Verificar si la IP está en alguna blacklist

2. **MXToolbox - SPF Check**
   - URL: https://mxtoolbox.com/spf.aspx
   - Ingresar: `ia.rpj.es`
   - Debe mostrar: PASS

3. **MXToolbox - DKIM Check**
   - URL: https://mxtoolbox.com/dkim.aspx
   - Ingresar: `default._domainkey.ia.rpj.es`
   - Debe mostrar: PASS

4. **Mail Tester**
   - URL: https://www.mail-tester.com/
   - Enviar un email de prueba a la dirección que te proporcionen
   - Te dará una puntuación sobre 10

### Paso 7: Revisar cola de correo en Plesk

1. En Plesk, ir a **Tools & Settings**
2. Click en **Mail Server Settings**
3. Click en **Mail Queue**
4. Ver si hay emails pendientes
5. Si hay emails en cola, revisar los errores

### Paso 8: Revisar logs de correo

1. En Plesk, ir a **Tools & Settings**
2. Click en **Logs**
3. Seleccionar **Mail Log**
4. Buscar por:
   - Queue ID: `2355D1C4505` (del test)
   - Dirección: `raul@rpj.es`
   - Estado: Ver si dice "sent" o algún error

## Configuración alternativa: Gmail SMTP Relay

Si Plesk sigue dando problemas, puedes usar Gmail como relay:

### Requisitos:
1. Cuenta de Gmail (o Google Workspace)
2. Activar "Contraseñas de aplicación" en Google

### Configuración en .env:
```env
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="tu-email@gmail.com"
EMAIL_PASSWORD="xxxx xxxx xxxx xxxx"  # Contraseña de aplicación
```

**Ventajas:**
- No requiere configurar SPF/DKIM en tu dominio
- Gmail tiene buena reputación de entrega
- Menos problemas de spam

**Desventajas:**
- Límite de 500 emails por día
- Los emails aparecen enviados desde Gmail

## Próximos pasos

1. ✅ Aplicación ya está configurada correctamente
2. ⚠️ **Configurar SPF en DNS** (5 minutos)
3. ⚠️ **Activar DKIM en Plesk** (2 minutos)
4. ⚠️ **Verificar que no estás en blacklist** (2 minutos)
5. ⚠️ **Revisar cola de correo en Plesk** (3 minutos)
6. ⚠️ **Probar envío desde la aplicación**
7. ⚠️ **Verificar que llega el email** (revisar SPAM)

## Comandos útiles para verificar

```bash
# Test de envío desde backend
cd /var/www/vhosts/ia.rpj.es/httpdocs/backend
node test_direct_email.js

# Ver logs de backend
npx pm2 logs rpjia-backend --lines 50 | grep -i email

# Test de conexión SMTP
node scripts/test_email.js
```

## Contacto y soporte

Si después de configurar SPF/DKIM los emails siguen sin llegar:

1. Contactar con el soporte de Plesk/Hosting
2. Proporcionarles el Queue ID de un email: `2355D1C4505`
3. Pedirles que revisen por qué los emails no se están entregando
4. Verificar si hay límites de envío configurados

## Referencias

- [Plesk: Configurar SPF](https://docs.plesk.com/en-US/obsidian/administrator-guide/mail/spf-records.65149/)
- [Plesk: Configurar DKIM](https://docs.plesk.com/en-US/obsidian/administrator-guide/mail/dkim.65151/)
- [MXToolbox](https://mxtoolbox.com/)
- [Mail Tester](https://www.mail-tester.com/)

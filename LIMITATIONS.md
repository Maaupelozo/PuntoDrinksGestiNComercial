# Limitaciones conocidas

- Las ventas y compras confirmadas no tienen anulación ni devolución auditada. No se deben borrar o editar directamente para corregir resultados.
- El flujo de caja es una estimación de movimientos registrados; no hay conciliación bancaria, saldos de efectivo, pagos parciales ni cuentas por cobrar.
- El resultado operativo no incluye impuestos, cargos financieros ni ajustes contables o fiscales.
- Las pruebas de concurrencia cubren casos transaccionales concretos, no una carga masiva sostenida.
- Cada usuario posee sus propios datos. Compartir una misma operación entre varias personas requerirá un modelo de organización y permisos nuevo.
- El logo se configura mediante una URL HTTPS; no hay carga de archivos a Supabase Storage. El emblema PD sigue disponible como alternativa.
- El proveedor de correo predeterminado de Supabase tiene restricciones; la recuperación productiva exige SMTP propio y una prueba real de recepción y apertura.
- El sitio HTTPS de Netlify pasó ingreso, cierre, persistencia de sesión y una escritura/lectura de producto. El recorrido financiero completo no se repitió allí. La recuperación por correo devolvió `over_email_send_rate_limit` y aún no se verificó desde ese dominio. Tampoco se ha ensayado una restauración real de backup en un proyecto separado.

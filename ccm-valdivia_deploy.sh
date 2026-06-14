#!/bin/bash

set -e

# ============================================================
# CONFIGURACIÓN FTP
# ============================================================
FTP_USER="ragnax@ccm-valdivia.cl"
FTP_HOST="ftp.ccm-valdivia.cl"
LOCAL_DIR="dist/ccm-valdivia-front/browser"

# ============================================================
# VALIDAR Y CARGAR ARCHIVO DE CONTRASEÑA
# ============================================================
if [ ! -f ".ftp_pass" ]; then
    echo "❌ Error: No existe el archivo .ftp_pass"
    exit 1
fi

FTP_PASS=$(tr -d '\r\n' < .ftp_pass)

# ============================================================
# BUILD ANGULAR
# ============================================================
echo ""
echo "🚀 Compilando Angular..."
echo ""

ng build --configuration production

# ============================================================
# AUDITORÍA LOCAL (CONTEO DE ARCHIVOS GENERADOS)
# ============================================================
if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Error: No existe $LOCAL_DIR"
    exit 1
fi

echo "📊 --- AUDITORÍA DE ARCHIVOS GENERADOS LOCALMENTE ---"
TOTAL_HTML=$(find "$LOCAL_DIR" -type f -name "*.html" | wc -l | tr -d ' ')
TOTAL_JS=$(find "$LOCAL_DIR" -type f -name "*.js" | wc -l | tr -d ' ')
TOTAL_CSS=$(find "$LOCAL_DIR" -type f -name "*.css" | wc -l | tr -d ' ')
TOTAL_ASSETS=$(find "$LOCAL_DIR" -type f ! -name "*.html" ! -name "*.js" ! -name "*.css" | wc -l | tr -d ' ')
TOTAL_ARCHIVOS=$(find "$LOCAL_DIR" -type f | wc -l | tr -d ' ')

echo "  ▪️ Archivos HTML: $TOTAL_HTML"
echo "  ▪️ Archivos JS (Chunks): $TOTAL_JS"
echo "  ▪️ Archivos CSS (Estilos): $TOTAL_CSS"
echo "  ▪️ Otros archivos (Imágenes/Icons): $TOTAL_ASSETS"
echo "  ▪️ TOTAL DE ARCHIVOS A TRANSFERIR: $TOTAL_ARCHIVOS"
echo "----------------------------------------------------"
echo ""

# ============================================================
# PREPARACIÓN DEL PAQUETE ZIP Y EXTRACTOR REMOTO CON LIMPIEZA
# ============================================================
echo "📦 Creando paquete de despliegue comprimido..."

CDIR=$(pwd)
cd "$LOCAL_DIR"

rm -f deploy.zip
zip -r deploy.zip ./* -x ".*" > /dev/null

# Creamos el script PHP que LIMPIA antes de descomprimir
cat << 'EOF' > unzip.php
<?php
$zipFile = 'deploy.zip';

if (file_exists($zipFile)) {
    // 1. FASE DE LIMPIEZA QUIRÚRGICA: Borramos archivos viejos de Angular
    // array_merge busca todos los archivos .js, .css e index.html en la carpeta actual
    $viejos = array_merge(glob("*.js"), glob("*.css"), glob("index.html"));
    foreach ($viejos as $archivo) {
        if (is_file($archivo)) {
            unlink($archivo); 
        }
    }
    
    // NOTA: Como glob("*.js") no coincide con ".htaccess", tu archivo de rutas está 100% a salvo.

    // 2. FASE DE DESCOMPRESIÓN
    $zip = new ZipArchive;
    if ($zip->open($zipFile) === TRUE) {
        $zip->extractTo('./');
        $zip->close();
        unlink($zipFile); // Borra el zip para no dejar basura
        echo "SUCCESS: Limpieza de estáticos viejos completa y descompresión remota completada.";
    } else {
        echo "ERROR: No se pudo abrir el archivo zip remitido.";
    }
} else {
    echo "ERROR: Archivo deploy.zip no encontrado en el servidor.";
}
unlink(__FILE__); // El script se autoelimina por seguridad
?>
EOF

# ============================================================
# TRANSFERENCIA SEGURA (UN SOLO VIAJE)
# ============================================================
echo "📤 Conectando al servidor FTP (Transferencia de archivo único)..."
echo ""

curl --ssl-reqd --ftp-pasv -k --user "${FTP_USER}:${FTP_PASS}" \
     -T "deploy.zip" "ftp://${FTP_HOST}/public_html/deploy.zip"

curl --ssl-reqd --ftp-pasv -k --user "${FTP_USER}:${FTP_PASS}" \
     -T "unzip.php" "ftp://${FTP_HOST}/public_html/unzip.php"

rm -f deploy.zip unzip.php
cd "$CDIR"

# ============================================================
# EJECUCIÓN REMOTA
# ============================================================
echo ""
echo "⚡ Ejecutando descompresión y limpieza automática en el servidor web..."

HTTP_RESPONSE=$(curl -s -k "https://ordenesdecompra.ccm-valdivia.cl/unzip.php")

echo ""
if [[ "$HTTP_RESPONSE" == *"SUCCESS"* ]]; then
    echo "✅ $HTTP_RESPONSE"
    echo "🎉 ¡Despliegue e higienización completados! Tu servidor quedó libre de chunks viejos."
else
    echo "⚠️ Respuesta del servidor: $HTTP_RESPONSE"
fi
echo ""
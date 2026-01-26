#!/bin/bash
# Regenerate PDFs for specified sessions
# Usage: ./regenerate-pdfs.sh <session_id> [session_id...]
# This regenerates PDFs using the current code (with fixes) and replaces stored copies

set -e

BASE_URL="${LUXEBRIEF_URL:-http://localhost:3001}"
DATA_DIR="${LUXEBRIEF_DATA:-/var/www/luxebrief/data}"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <session_id> [session_id...]"
    echo "Example: $0 10 17 28"
    exit 1
fi

echo "=== PDF Regeneration Script ==="
echo "Base URL: $BASE_URL"
echo "Data Dir: $DATA_DIR"
echo ""

for SESSION_ID in "$@"; do
    echo "Processing session ${SESSION_ID}..."

    # Call export/pdf to regenerate with current (fixed) code
    HTTP_CODE=$(curl -s -w "%{http_code}" "${BASE_URL}/api/sessions/${SESSION_ID}/export/pdf" -o "/tmp/session_${SESSION_ID}.pdf")

    if [ "$HTTP_CODE" != "200" ]; then
        echo "  ✗ HTTP ${HTTP_CODE} - Failed to generate PDF"
        rm -f "/tmp/session_${SESSION_ID}.pdf"
        continue
    fi

    if [ ! -s "/tmp/session_${SESSION_ID}.pdf" ]; then
        echo "  ✗ Generated PDF is empty"
        rm -f "/tmp/session_${SESSION_ID}.pdf"
        continue
    fi

    # Find the session directory
    SESSION_DIR=$(find "${DATA_DIR}/briefings" -maxdepth 1 -type d -name "*-${SESSION_ID}" 2>/dev/null | head -1)

    if [ -z "$SESSION_DIR" ] || [ ! -d "$SESSION_DIR" ]; then
        echo "  ⚠ Session directory not found, skipping storage update"
        rm -f "/tmp/session_${SESSION_ID}.pdf"
        continue
    fi

    PDF_PATH="${SESSION_DIR}/reports/report.pdf"

    # Backup existing PDF
    if [ -f "$PDF_PATH" ]; then
        BACKUP="${PDF_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$PDF_PATH" "$BACKUP"
        echo "  Backed up to: $(basename $BACKUP)"
    fi

    # Replace with new PDF
    mkdir -p "${SESSION_DIR}/reports"
    mv "/tmp/session_${SESSION_ID}.pdf" "$PDF_PATH"
    echo "  ✓ Updated: ${PDF_PATH}"

    # Show page count if pdfinfo available
    if command -v pdfinfo &> /dev/null; then
        PAGES=$(pdfinfo "$PDF_PATH" 2>/dev/null | grep "Pages:" | awk '{print $2}')
        echo "  Pages: ${PAGES}"
    fi
    echo ""
done

echo "=== Complete ==="

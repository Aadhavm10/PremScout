#!/bin/bash

echo "🚀 Testing FPL prediction update process..."

# Run the prediction script
echo "📊 Running FPL.py..."
python FPL.py

# Update timestamp
echo "🕐 Updating timestamp..."
echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" > last_updated.txt

echo "✅ Update process completed!"
echo "📄 Generated files:"
ls -la gameweek_*_predictions.csv last_updated.txt 2>/dev/null || echo "❌ No files found"

echo ""
echo "🕐 Last updated: $(cat last_updated.txt 2>/dev/null || echo 'No timestamp file')"

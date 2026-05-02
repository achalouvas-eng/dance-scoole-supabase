#!/bin/bash

echo "🔄 Saving project..."

git add .

# Check if there are changes
if git diff --cached --quiet; then
  echo "✅ Nothing to commit"
else
  COMMIT_MSG="Auto-save: $(date '+%Y-%m-%d %H:%M:%S')"
  git commit -m "$COMMIT_MSG"
  git push
  echo "🚀 Changes pushed to GitHub"
fi

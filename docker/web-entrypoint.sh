#!/bin/sh
set -e

cat > /app/apps/web/dist/env.js <<EOF
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL}"
};
EOF

exec pnpm preview --host 0.0.0.0 --port 3000

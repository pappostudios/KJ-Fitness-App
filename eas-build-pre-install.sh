#!/usr/bin/env bash
# EAS Build pre-install hook
# If GOOGLE_SERVICES_JSON is set (base64-encoded), write it to android/app/.
# If it is NOT set, the file should already exist in git — verify and abort
# early with a clear message rather than letting Gradle fail cryptically.

set -euo pipefail

if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "GOOGLE_SERVICES_JSON secret found — writing android/app/google-services.json"
  echo "$GOOGLE_SERVICES_JSON" | base64 --decode > android/app/google-services.json
  echo "google-services.json written successfully."
elif [ -f "android/app/google-services.json" ]; then
  echo "google-services.json already present in project (committed to git)."
else
  echo "ERROR: android/app/google-services.json is missing."
  echo "Either commit the file or set the GOOGLE_SERVICES_JSON EAS secret."
  exit 1
fi

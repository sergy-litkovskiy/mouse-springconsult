#!/usr/bin/env bash
# Cheap check before the @claude agent: reads the GitHub thread text from stdin and exits 1
# when it holds a pattern that has no business reaching a model with repository rights.
# Blocks instead of masking: the owner never needs hidden text in a thread.
set -euo pipefail

input=$(cat)

patterns=(
  '\.env'
  'private key'
  'ssh key'
  'send.*secret'
  'відправ.*секрет'
  'надішли.*ключ'
  'printenv|env\b|CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY'
  'curl|wget'
  '\.github/workflows|\.claude/'
  'ignore (all |previous )?instructions|ігноруй'
  '<!--'
)

for pattern in "${patterns[@]}"; do
  if grep -qiE -- "$pattern" <<<"$input"; then
    echo "blocked: /$pattern/" >&2
    exit 1
  fi
done

# U+200B..U+200F as UTF-8 bytes: a byte range in the C locale behaves the same in GNU and BSD grep.
if LC_ALL=C grep -q "$(printf '\342\200[\213-\217]')" <<<"$input"; then
  echo "blocked: zero-width character" >&2
  exit 1
fi

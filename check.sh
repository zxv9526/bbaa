#!/bin/bash
files=$(find src -name "*.tsx")
for file in $files; do
  tags=$(grep -oE "<[A-Z][a-zA-Z0-9_]*" "$file" | sed 's/<//' | sort | uniq)
  for tag in $tags; do
    if ! grep -q "$tag" "$file"; then
       echo "Tag $tag not found in $file"
    fi
    # Check if tag is imported or defined
    if ! grep -qE "import.*$tag|const $tag|function $tag|class $tag" "$file"; then
      # it might be a component in the same file or a typo
      echo "Possible missing import/definition for $tag in $file"
    fi
  done
done

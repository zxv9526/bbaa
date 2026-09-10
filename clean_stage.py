import re

with open('src/components/ShowdownStage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove explanatory texts for steps to keep UI minimal
code = re.sub(
    r'\{\/\* Step Details & Explanations \*\/\}.*?\{currentStep === \'summary\' && \(',
    r'''{/* FINAL SUMMARY LEDGER */}
      {currentStep === 'summary' && (''',
    code,
    flags=re.DOTALL
)

with open('src/components/ShowdownStage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

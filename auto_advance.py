import re

with open('src/components/ShowdownStage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make it advance steps faster and auto jump to summary
code = re.sub(
    r'setTimeout\(\(\) => \{[\s\S]*?setCurrentStep\(\'middle\'\)[\s\S]*?\}, \d+\);',
    r"setTimeout(() => { if (autoPlay) { sounds.play('playCard'); setCurrentStep('middle'); } }, 600);",
    code
)

code = re.sub(
    r'setTimeout\(\(\) => \{[\s\S]*?setCurrentStep\(\'back\'\)[\s\S]*?\}, \d+\);',
    r"setTimeout(() => { if (autoPlay) { sounds.play('playCard'); setCurrentStep('back'); } }, 600);",
    code
)

code = re.sub(
    r'setTimeout\(\(\) => \{[\s\S]*?setCurrentStep\(\'guns\'\)[\s\S]*?\}, \d+\);',
    r"setTimeout(() => { if (autoPlay) { sounds.play('playCard'); setCurrentStep('summary'); } }, 600);",
    code
)

code = re.sub(
    r'setTimeout\(\(\) => \{[\s\S]*?setCurrentStep\(\'summary\'\)[\s\S]*?\}, \d+\);',
    r"setTimeout(() => { if (autoPlay) { sounds.play('playCard'); setCurrentStep('summary'); } }, 600);",
    code
)


with open('src/components/ShowdownStage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

import os
import re

def strip_comments(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    if file_path.endswith('.py'):

        content = re.sub(r'^\s*#.*$', '', content, flags=re.MULTILINE)
        
    elif file_path.endswith('.ts') or file_path.endswith('.tsx') or file_path.endswith('.js'):

        content = re.sub(r'^\s*//.*$', '', content, flags=re.MULTILINE)

        content = re.sub(r'/\*[\s\S]*?\*/', '', content)

        content = re.sub(r'\s+//\s.*$', '', content, flags=re.MULTILINE)

    content = re.sub(r'\n{3,}', '\n\n', content)

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content.strip() + '\n')
        print(f"Stripped comments from {file_path}")

def main():
    for root, _, files in os.walk('.'):
        if 'node_modules' in root or '.next' in root or 'venv' in root or '.git' in root:
            continue
        for file in files:
            if file.endswith(('.py', '.ts', '.tsx', '.js', '.jsx')):
                strip_comments(os.path.join(root, file))

if __name__ == "__main__":
    main()

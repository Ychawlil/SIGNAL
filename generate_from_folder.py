import json
import os
import re

ORIGINAL_DIR = r'public\image\original'
SRC_IMAGES = r'C:\Users\dongj\Desktop\PixivCollection-main\images.json'
DST = r'public\backgrounds.json'

# 读取原始 images.json，用来补 size（可选，仅保持格式一致）
size_map = {}
if os.path.exists(SRC_IMAGES):
    with open(SRC_IMAGES, 'r', encoding='utf-8') as f:
        for img in json.load(f):
            key = f"{img['id']}_p{img['part']}.{img['ext']}"
            size_map[key] = img.get('size', [0, 0])

pattern = re.compile(r'^(\d+)_p(\d+)\.(\w+)$')
backgrounds = []

for name in sorted(os.listdir(ORIGINAL_DIR)):
    m = pattern.match(name)
    if not m:
        print(f'跳过不符合命名的文件: {name}')
        continue
    image_id, part, ext = int(m.group(1)), int(m.group(2)), m.group(3)
    backgrounds.append({
        'id': image_id,
        'part': part,
        'ext': ext,
        'size': size_map.get(name, [0, 0]),
    })

with open(DST, 'w', encoding='utf-8') as f:
    json.dump(backgrounds, f, ensure_ascii=False, indent=2)

print(f'共 {len(backgrounds)} 张背景图已写入 {DST}')
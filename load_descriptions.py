#!/usr/bin/env python3
"""
Загрузка описаний университетов из universities_cards.md в БД
"""
import re
import sqlite3
import os
import sys

# Пути
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CARDS_FILE = os.path.join(SCRIPT_DIR, 'universities_cards.md')
DB_PATH = os.path.join(SCRIPT_DIR, 'backend', 'edumatch.db')

def parse_descriptions():
    """Парсит описания из universities_cards.md"""
    with open(CARDS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Разбиваем по заголовкам университетов
    # Паттерн: # **Name (Abbr)**
    uni_pattern = r'# \*\*([^(]+)\(([^)]+)\)\*\*'
    
    universities = []
    
    # Ищем все университеты
    matches = list(re.finditer(uni_pattern, content))
    
    for i, match in enumerate(matches):
        uni_name = match.group(1).strip()
        uni_abbr = match.group(2).strip()
        
        # Получаем текст от этого университета до следующего
        start_pos = match.end()
        if i + 1 < len(matches):
            end_pos = matches[i + 1].start()
        else:
            end_pos = len(content)
        
        uni_section = content[start_pos:end_pos]
        
        # Ищем "О университете:" и извлекаем описание
        desc_match = re.search(r'\*\*О университете:\*\*(.*?)(?=\n\*\*|# \*\*|$)', uni_section, re.DOTALL)
        
        if desc_match:
            description = desc_match.group(1).strip()
            # Удаляем лишние пробелы и переносы
            description = re.sub(r'\n+', ' ', description)
            description = re.sub(r'\s+', ' ', description)
            
            universities.append({
                'name': uni_name,
                'abbr': uni_abbr,
                'description': description
            })
    
    return universities

def update_database(universities):
    """Обновляет БД описаниями"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updated_count = 0
    not_found_count = 0
    
    print(f"Загружаю {len(universities)} описаний...")
    
    for uni in universities:
        # Пытаемся найти университет по имени
        cursor.execute(
            'SELECT id FROM universities WHERE name LIKE ? OR short_name LIKE ?',
            (f'%{uni["name"]}%', f'%{uni["abbr"]}%')
        )
        
        result = cursor.fetchone()
        
        if result:
            uni_id = result[0]
            cursor.execute(
                'UPDATE universities SET description = ? WHERE id = ?',
                (uni['description'], uni_id)
            )
            updated_count += 1
            print(f"✓ {uni['name']} ({uni['abbr']}) - обновлено")
        else:
            not_found_count += 1
            print(f"✗ {uni['name']} ({uni['abbr']}) - не найден в БД")
    
    conn.commit()
    conn.close()
    
    print(f"\n📊 Результаты:")
    print(f"   Обновлено: {updated_count}")
    print(f"   Не найдено: {not_found_count}")

def main():
    print("🔍 Парсинг университетов из universities_cards.md...")
    universities = parse_descriptions()
    print(f"✓ Найдено {len(universities)} университетов\n")
    
    if not universities:
        print("❌ Описания не найдены!")
        return
    
    print("💾 Загрузка в БД...")
    update_database(universities)
    print("\n✅ Готово!")

if __name__ == '__main__':
    main()

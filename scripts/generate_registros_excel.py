# scripts\generate_registros_excel.py
import json
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
ALUMNOS_FILE = BASE_DIR / 'public' / 'alumnos.json'
OUTPUT_FILE = BASE_DIR / 'dataBase' / 'registros_pagos.xlsx'

if not ALUMNOS_FILE.exists():
    raise FileNotFoundError(f'No se encontró: {ALUMNOS_FILE}')

print(f'Leyendo alumnos desde: {ALUMNOS_FILE}')
with ALUMNOS_FILE.open('r', encoding='utf-8') as f:
    alumnos = json.load(f)

print(f'Generando Excel template con {len(alumnos)} alumnos...')

records = []
for alumno in alumnos:
    record = {
        'NO_CONTROL': alumno['control'],
        'NOMBRE': alumno['nombre'],
        'APELLIDOS': alumno['apellidos'],
        'CARRERA': alumno['carrera'],
        'TURNO': alumno['turno'],
        'semestre_1': False,
        'semestre_2': False,
        'semestre_3': False,
        'semestre_4': False,
        'semestre_5': False,
        'semestre_6': False,
    }
    records.append(record)

df = pd.DataFrame(records)
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
with pd.ExcelWriter(OUTPUT_FILE, engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='registros', index=False)

print(f'Excel generado: {OUTPUT_FILE}')
print(f'Estructura:')
print(f'  - Filas: {len(df)}')
print(f'  - Columnas: {list(df.columns)}')

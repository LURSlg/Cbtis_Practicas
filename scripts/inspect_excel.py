import json
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_FILE = BASE_DIR / 'dataBase' / 'DETALLE 2026 13 DE MAYO.xlsx'
OUTPUT_FILE = BASE_DIR / 'public' / 'alumnos.json'

if not INPUT_FILE.exists():
    raise FileNotFoundError(f'No se encontró el archivo Excel: {INPUT_FILE}')

print(f'Leyendo archivo: {INPUT_FILE}')

df = pd.read_excel(INPUT_FILE)
df.columns = [str(col).strip() for col in df.columns]

print('Estructura del archivo:')
print(f'  Filas: {len(df)}')
print(f'  Columnas: {len(df.columns)}')
print('  Nombres de columnas:')
for idx, col in enumerate(df.columns, start=1):
    print(f'    {idx}. {col}')

print('\nPrimeras filas:')
print(df.head(10).to_string(index=False))

print('\nExportando JSON para uso en la app...')

records = []
for row in df.to_dict(orient='records'):
    records.append({
        'control': str(row.get('NO CONTROL', '')).strip(),
        'nombre': str(row.get('NOMBRE', '')).strip(),
        'apellidos': str(row.get('APELLIDOS', '')).strip(),
        'carrera': str(row.get('CARRERA', '')).strip(),
        'turno': str(row.get('TURNO', '')).strip(),
        'semestre': str(row.get('SEMESTRE', '')).strip(),
        'grupo': str(row.get('GRUPO', '')).strip(),
        'correo': str(row.get('CORREO', '')).strip(),
    })

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT_FILE.open('w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f'Se generó JSON con {len(records)} registros en: {OUTPUT_FILE}')

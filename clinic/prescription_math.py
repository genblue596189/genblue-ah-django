"""Arithmetic ported from the existing UI; no clinical dose recommendations."""
import math
import re
import unicodedata

NUMBER = r'(\d+(?:\.\d+)?|\.\d+)'


def strength_per_unit(text):
    text = unicodedata.normalize('NFKC', str(text or '')).strip()
    if not text or re.search(r'\b(?:ml|dl|l|kg)\b|毫升|公升|公斤|%', text, re.I):
        return None
    matches = list(re.finditer(NUMBER + r'\s*(mg|mcg|μg|ug|g|毫克|微克|公克)(?![a-z])', text, re.I))
    if len(matches) != 1 or re.search(r'-\s*\d|\d\s*[,，]\s*\d', text):
        return None
    hit = matches[0]
    tail, before = text[hit.end():].strip(), text[:hit.start()].strip()
    if tail and not re.fullmatch(r'(?:/\s*(?:1\s*)?(?:顆|錠|粒|膠囊|tablet|tab|capsule|cap)|每(?:顆|錠|粒|膠囊))', tail, re.I):
        return None
    if before and not re.fullmatch(r'(?:每(?:顆|錠|粒|膠囊)(?:含)?|含量[:：]?)', before):
        return None
    amount, unit = float(hit[1]), hit[2].lower()
    factor = 1000 if unit in ('g','公克') else .001 if unit in ('mcg','μg','ug','微克') else 1
    return amount * factor if math.isfinite(amount) and amount > 0 else None


def volume(dose, weight, unit, strength):
    if unit == 'ml': return dose
    if unit == 'ml/kg': return dose * weight
    if unit not in ('IU/kg','mg/kg'): return None
    text = re.sub(r'\s', '', unicodedata.normalize('NFKC', str(strength or '')))
    hit = re.fullmatch(NUMBER + r'(IU|mg|mcg|μg|ug|g)/(?:' + NUMBER + r')?ml', text, re.I)
    if not hit: return None
    amount, raw, denominator = float(hit[1]), hit[2].lower(), float(hit[3] or 1)
    if amount <= 0 or denominator <= 0: return None
    expected = 'IU' if raw == 'iu' else 'mg'
    if expected != unit.split('/')[0]: return None
    factor = 1000 if raw == 'g' else .001 if raw in ('mcg','μg','ug') else 1
    concentration = amount * factor / denominator
    if not math.isfinite(concentration) or concentration <= 0: return None
    result = dose * weight / concentration
    return result if math.isfinite(result) and result > 0 else None


def calculate(data, medicine):
    def stop(message): return {'quantity':'', 'display':message}
    injection = data['route'] in ('皮下注射','肌肉注射','靜脈注射')
    dose, weight = float(data['dose'] or 0), float(data['weight'] or 0)
    frequency = 1 if injection else float(data['frequency'] or 0)
    days = 1.0 if injection else float(data['days'] or 0)
    if frequency == 0: return stop('PRN 請手動確認實際開立數量')
    if not all(math.isfinite(n) and n > 0 for n in (dose,weight,frequency,days)) or not days.is_integer():
        return stop('請填寫有效的體重、劑量、頻率及整數天數')
    strength = medicine.get('usage_dose') or medicine.get('strength') or ''
    if injection:
        total = volume(dose,weight,data['unit'],strength)
        if total is None: return stop('劑量單位與規格濃度不符，請核對例如 2000IU/0.3ml；不自動推測')
        scaled = (total + 2**-52) * 1000 + .5
        if not math.isfinite(scaled): return stop('請檢查計算欄位')
        rounded = math.floor(scaled) / 1000
        if rounded == 0: return stop('用量少於 0.001 ml，請手動核對可量取用量')
        quantity = format(rounded,'.15g')
        return {'quantity':quantity,'display':'建議單次用量 '+quantity+' ml'}
    per_unit = strength_per_unit(strength)
    if not per_unit: return stop('請確認每顆含量，例如 250mg/顆；無法自動換算')
    total = dose * weight * frequency * days / per_unit
    if not math.isfinite(total): return stop('請檢查計算欄位')
    scaled = (total + 2**-52 * max(1,abs(total))) * 10 + .5
    if not math.isfinite(scaled): return stop('請檢查計算欄位')
    rounded = math.floor(scaled) / 10
    if total > 0 and rounded == 0: return stop('總量少於 0.1 顆，請手動確認開立數量')
    return {'quantity':format(rounded,'.15g'),'display':f'建議總需 {rounded:.1f} 顆'}

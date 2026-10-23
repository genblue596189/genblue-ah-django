"""Validate new record submissions without rewriting historical prescription JSON."""
from decimal import Decimal, InvalidOperation
import re
from .views import GatewayError


def reject(row, message):
    raise GatewayError(400, f'第 {row} 筆處方：{message}；尚未儲存，請保留畫面修正。', 'GB_PRESCRIPTION_INVALID')


def number(value, row, label, allow_zero=False):
    if isinstance(value,bool) or not isinstance(value,(str,int,float)):
        reject(row,label+'須為有效數字')
    text=str(value).strip()
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?',text):
        reject(row,label+'須為有效數字')
    try:
        result=Decimal(text)
    except InvalidOperation:
        reject(row,label+'須為有效數字')
    if not result.is_finite() or result<0 or (not allow_zero and result==0):
        reject(row,label+('不可小於零' if allow_zero else '須大於零'))
    return result


def validate_prescriptions(rows):
    """Only inspect; retain exact strings, units, metadata and unknown fields."""
    if not isinstance(rows,list):
        reject(1,'處方清單格式不正確')
    for index,row in enumerate(rows,1):
        if not isinstance(row,dict): reject(index,'處方格式不正確')
        number(row.get('quantity'),index,'實際開立數量')
        dose=row.get('custom_dose')
        if not isinstance(dose,str) or not dose.strip():reject(index,'請填寫使用劑量及單位')
        if re.search(r'劑量待確認|單位',dose) or re.fullmatch(r'(?:\d+(?:\.\d+)?|\.\d+)',dose.strip()):
            reject(index,'請確認使用劑量單位，例如 mg/kg、ml/kg 或 ml')
        group=row.get('dispensing_group')
        if group is None:continue  # Older entries without groups remain compatible.
        if not isinstance(group,dict):reject(index,'配藥組別格式不正確')
        if 'frequency' in group:number(group['frequency'],index,'本組頻次',allow_zero=True)
        if 'days' in group:
            days=number(group['days'],index,'本組天數')
            if days!=days.to_integral_value():reject(index,'本組天數須為正整數')
        preparation=group.get('preparation_v94')
        if preparation is None:continue
        if not isinstance(preparation,dict):reject(index,'配藥方式格式不正確')
        # Legacy per-dose metadata is retained without guessing a delivery total.
        # An empty total remains an explicitly unconfirmed plan, as in the UI.
        if 'total' in preparation and preparation['total'] not in ('',None):
            total=number(preparation['total'],index,'交付總量')
            if total>1_000_000:reject(index,'交付總量超出現有配藥欄位上限')

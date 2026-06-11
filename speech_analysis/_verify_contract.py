# -*- coding: utf-8 -*-
"""계약 동등성 검증: /analyze-question (HTTP) vs run_question_analysis.py (CLI).

동일 입력으로 두 결과 JSON을 비교해 키/값이 일치하는지 확인한다.
"""
import json
import os
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, "Take4-1_누구 좀 불러야제잉_2026-06-08.wav")
QTYPE = "그림 설명하기"
QTEXT = "그림을 보고 어떤 장면인지 설명해 주세요."
IMGDESC = "전통시장 좌판에서 상인이 과일을 저울에 달고, 손님이 돈을 꺼내는 장면입니다."

# 1) HTTP 호출
payload = json.dumps({
    "audio_path": AUDIO,
    "question_type_name": QTYPE,
    "question_text": QTEXT,
    "image_description": IMGDESC,
    "use_llm_scoring": False,
}).encode("utf-8")
req = urllib.request.Request(
    "http://localhost:8000/analyze-question",
    data=payload,
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=120) as resp:
    http_result = json.loads(resp.read().decode("utf-8"))

# 2) CLI 호출 (run_question_analysis.py)
env = dict(os.environ, KMP_DUPLICATE_LIB_OK="TRUE", PYTHONIOENCODING="utf-8")
cli = subprocess.run(
    [sys.executable, os.path.join(HERE, "run_question_analysis.py"),
     "--audio-path", AUDIO,
     "--question-type-name", QTYPE,
     "--question-text", QTEXT,
     "--image-description", IMGDESC,
     "--use-llm-scoring", "false"],
    capture_output=True, text=True, encoding="utf-8", env=env, cwd=HERE,
)
out = cli.stdout.strip()
start, end = out.find("{"), out.rfind("}")
cli_result = json.loads(out[start:end + 1])

# 3) 비교
keys = sorted(set(http_result) | set(cli_result))
print(f"HTTP 키수={len(http_result)}  CLI 키수={len(cli_result)}")
print(f"키 동일: {set(http_result) == set(cli_result)}")
diffs = []
for k in keys:
    hv, cv = http_result.get(k, "<없음>"), cli_result.get(k, "<없음>")
    same = hv == cv
    if not same:
        diffs.append((k, hv, cv))
    print(f"  {'OK ' if same else 'DIFF'} {k}: http={hv!r} cli={cv!r}")

print()
print("=> 계약 동등성:", "일치 ✓" if not diffs else f"불일치 {len(diffs)}건")

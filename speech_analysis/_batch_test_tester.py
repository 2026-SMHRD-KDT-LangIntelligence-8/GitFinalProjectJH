# -*- coding: utf-8 -*-
"""테스터 음성(webm) 일괄 분석 테스트.

파일명 규칙: {유형}_{q문항ID}_{시각}.webm
q### -> DB question_id 로 매칭하여 question_text / 그림설명기준을 사용한다.
노이즈 제거(ffmpeg)가 webm -> wav 변환도 겸하므로 webm 입력이 그대로 동작한다.
"""

import os
import re
import csv
import json
import sys

from speech_analysis_pipeline import analyze_question_answer

TESTER_DIR = r"C:\Users\smhrd\Documents\카카오톡 받은 파일\PJH_테스트용_260611\노이즈"
QUESTION_TSV = os.path.join(os.path.dirname(__file__), "_questions_for_test.tsv")
RESULT_JSON = os.path.join(os.path.dirname(__file__), "_tester_results.json")
USE_LLM_SCORING = True


def load_question_map(tsv_path):
    """question_id -> (유형명, 문항텍스트, 그림설명기준 or None) 매핑을 만든다."""
    question_map = {}
    with open(tsv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            qid = int(row["question_id"])
            image_desc = row["image_description_criteria"]
            if image_desc in (None, "", "NULL"):
                image_desc = None
            question_map[qid] = (
                row["question_type_name"],
                row["question_text"],
                image_desc,
            )
    return question_map


def main():
    question_map = load_question_map(QUESTION_TSV)

    audio_extensions = (".webm", ".wav", ".mp3", ".m4a", ".ogg")
    files = sorted(
        f for f in os.listdir(TESTER_DIR)
        if f.lower().endswith(audio_extensions)
    )

    results = []
    for index, filename in enumerate(files, start=1):
        match = re.search(r"q(\d+)", filename)
        if not match:
            print(f"[{index}/{len(files)}] 문항ID 파싱 실패: {filename}", flush=True)
            continue

        qid = int(match.group(1))
        if qid not in question_map:
            print(f"[{index}/{len(files)}] DB에 없는 문항ID q{qid}: {filename}", flush=True)
            continue

        type_name, question_text, image_desc = question_map[qid]
        audio_path = os.path.join(TESTER_DIR, filename)

        print(f"[{index}/{len(files)}] 분석 시작 q{qid} ({type_name}) - {filename}", flush=True)

        result = analyze_question_answer(
            audio_path=audio_path,
            question_type_name=type_name,
            question_text=question_text,
            image_description=image_desc,
            use_llm_scoring=USE_LLM_SCORING,
        )

        record = {
            "file": filename,
            "question_id": qid,
            "question_type_name": type_name,
            "stt_text": result["stt_text"],
            "response_time": result["response_time"],
            "repetition_ratio": result["repetition_ratio"],
            "avg_sentence_length": result["avg_sentence_length"],
            "appropriateness_score": result["appropriateness_score"],
            "repetition_score": result["repetition_score"],
            "sentence_length_score": result["sentence_length_score"],
        }
        results.append(record)
        print(
            f"    STT: {result['stt_text']!r} | "
            f"반응시간 {result['response_time']} | "
            f"반복률 {result['repetition_ratio']} | "
            f"답변길이 {result['avg_sentence_length']}",
            flush=True,
        )

    with open(RESULT_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n총 {len(results)}건 분석 완료. 결과 저장: {RESULT_JSON}", flush=True)


if __name__ == "__main__":
    main()

import json
import sys

from speech_analysis_pipeline import calculate_report_summary


def main():
    # 표준 입력으로 받은 여러 문항 분석 행을 종합해 리포트 요약 JSON으로 변환한다.
    raw_input = sys.stdin.read().strip()
    analysis_rows = json.loads(raw_input) if raw_input else []
    summary = calculate_report_summary(analysis_rows)
    json.dump(summary, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()

import argparse
import json
import sys

from speech_analysis_pipeline import analyze_question_answer, calculate_question_final_score


# 문자열로 들어오는 불리언 인자를 파이썬 bool 값으로 변환한다.
def parse_bool(value):
    return str(value).strip().lower() in {"1", "true", "y", "yes"}


def main():
    # 자바 백엔드에서 넘겨준 문항 정보를 받아 단건 음성 분석 결과를 JSON으로 출력한다.
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-path", required=True)
    parser.add_argument("--question-type-name", required=True)
    parser.add_argument("--question-text", required=True)
    parser.add_argument("--image-description", default="")
    parser.add_argument("--use-llm-scoring", default="false")
    args = parser.parse_args()

    result = analyze_question_answer(
        audio_path=args.audio_path,
        question_type_name=args.question_type_name,
        question_text=args.question_text,
        image_description=args.image_description or None,
        use_llm_scoring=parse_bool(args.use_llm_scoring)
    )

    scored = calculate_question_final_score({
        "question_type_name": args.question_type_name,
        "response_time": result.get("response_time"),
        "repetition_ratio": result.get("repetition_ratio"),
        "avg_sentence_length": result.get("avg_sentence_length"),
        "appropriateness_score": result.get("appropriateness_score"),
    })

    payload = {
        **result,
        "question_type_name": args.question_type_name,
        "response_time_score": scored.get("response_time_score"),
        "repetition_score": scored.get("repetition_score"),
        "sentence_length_score": scored.get("answer_length_score"),
        "final_score": scored.get("final_score"),
    }

    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()

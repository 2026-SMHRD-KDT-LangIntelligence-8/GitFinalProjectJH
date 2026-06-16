from speech_analysis_pipeline import calculate_report_summary

analysis_rows = [
    {
        "question_type_name": "오늘 날짜 말하기",
        "response_time": 1.8,
        "repetition_ratio": 0.0,
        "avg_sentence_length": 8.0,
        "appropriateness_score": 100,
    },
    {
        "question_type_name": "그림 설명하기",
        "response_time": 3.2,
        "repetition_ratio": 5.0,
        "avg_sentence_length": 28.0,
        "appropriateness_score": 80,
    },
    {
        "question_type_name": "상황 질문 답하기",
        "response_time": 2.5,
        "repetition_ratio": 0.0,
        "avg_sentence_length": 8.0,
        "appropriateness_score": 100,
    },
    {
        "question_type_name": "규칙 기반 언어추론",
        "response_time": 4.1,
        "repetition_ratio": 12.0,
        "avg_sentence_length": 7.0,
        "appropriateness_score": 100,
    },
    {
        "question_type_name": "추억 말하기",
        "response_time": 5.4,
        "repetition_ratio": 18.0,
        "avg_sentence_length": 32.0,
        "appropriateness_score": 80,
    },
]

report_summary = calculate_report_summary(analysis_rows)

print(report_summary)
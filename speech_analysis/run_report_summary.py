from speech_analysis_pipeline import calculate_report_summary


if __name__ == "__main__":
    sample_rows = [
        {
            "question_type_name": "오늘 날짜 말하기",
            "response_time": 1.2,
            "repetition_ratio": 0.0,
            "avg_sentence_length": 8.0,
            "appropriateness_score": 100,
        },
        {
            "question_type_name": "그림 설명하기",
            "response_time": 2.8,
            "repetition_ratio": 3.0,
            "avg_sentence_length": 20.0,
            "appropriateness_score": 80,
        },
    ]

    print(calculate_report_summary(sample_rows))

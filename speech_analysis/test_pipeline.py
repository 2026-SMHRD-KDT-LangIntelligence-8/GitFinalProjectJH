from speech_analysis_pipeline import analyze_question_answer

audio_path = "Take4-1_누구 좀 불러야제잉_2026-06-08.wav"

result = analyze_question_answer(
    audio_path=audio_path,
    question_type_name="그림 설명하기",
    question_text="그림을 보고 어떤 장면인지 설명해 주세요.",
    image_description="전통시장 좌판에서 상인이 과일을 저울에 달고, 손님이 돈을 꺼내는 장면입니다.",
    use_llm_scoring=False
)

print(result)
# STT 모델 정확도 근거 자료

> 작성 기준일: 2026-06-15
> 대상: 인지검사 음성 답변 STT(Speech-to-Text)에 사용 중인 모델
> 구현 위치: `speech_analysis/speech_analysis_pipeline.py` (`MODEL_NAME`, `transcribe_audio()`)

---

## 1. 요약
- 현재 STT 모델: **`seastar105/whisper-medium-komixv2`** (한국어 특화 파인튜닝 Whisper, 로컬 구동)
- 공식 벤치마크상 **평균 문자오류율(CER) 7.3%** 로, 상위 모델인 `whisper-large-v3`(7.99%)보다 **오히려 더 정확**(특히 한국어 대화체 KsponSpeech에서 큰 우위).
- 자체 현장 테스트(테스터 음성 25문항)에서 **대부분 정확 전사**, 짧은 단어 일부에서 모음 혼동성 오인식 관찰.

---

## 2. 모델 상세 정보
| 항목 | 내용 |
|---|---|
| 모델명 | `seastar105/whisper-medium-komixv2` |
| 베이스 | OpenAI **Whisper medium** |
| 파라미터 수 | 약 **0.8B**(769M급) |
| 대상 언어 | 한국어(Korean) 특화 파인튜닝 |
| 과제(task) | `transcribe`, `language=ko` (코드 설정) |
| 구동 방식 | 로컬 추론(서버 기동 시 1회 로드, FastAPI 상주) |
| 출처 | https://huggingface.co/seastar105/whisper-medium-komixv2 |
| 제작자 | seastar105 |

**학습 데이터 (AIHub 한국어 음성 코퍼스 다종)**
- 한국어 음성 데이터
- 주소 발화 음성 데이터
- 주요 도메인 회의 음성인식 데이터
- 저음질 전화망 음성인식 데이터
- 방송 콘텐츠 대화체 음성인식 데이터

**학습 설정**
- 50,000 steps / batch size 1,024
- Linear warmup + cosine decay, max LR 1e-4
- Google TPU Research Cloud(TRC) 지원

---

## 3. 정확도 — 공식 벤치마크 (CER, 낮을수록 좋음)
> CER(Character Error Rate, 문자오류율): (대치+삭제+삽입 문자 수) / 전체 문자 수. 한국어 ASR 평가의 표준 지표.
> 출처: 모델 카드(HuggingFace). 동일 테스트셋에서 `whisper-large-v3`와 비교.

| 테스트셋 | komixv2 (사용 모델) | whisper-large-v3 | 비고 |
|---|---|---|---|
| **평균(Average)** | **7.30** | 7.99 | 사용 모델이 더 우수 |
| cv_15_ko (Common Voice) | 6.62 | 5.11 | large-v3 우세 |
| fleurs_ko | 4.52 | 3.72 | large-v3 우세 |
| kspon_clean (KsponSpeech 정제) | **8.38** | 15.08 | 사용 모델 큰 우위 |
| kspon_other (KsponSpeech 잡음) | **9.19** | 12.89 | 사용 모델 큰 우위 |

**해석**
- 모델 크기는 medium(0.8B)으로 large-v3(1.5B)보다 작지만, **한국어 대화체(KsponSpeech)에서 오류율이 절반 수준**으로 낮아 평균 CER에서 앞섭니다.
- 우리 서비스는 **한국어 자유 발화(노인 인지검사 답변)** 가 대상이라, 낭독체(fleurs/cv)보다 **대화체 성능(KsponSpeech)** 이 더 중요 → 본 모델 선택이 합리적.
- 모델 크기가 작아 **로컬 구동 비용/지연이 large 대비 유리**(서버 운영 측면 이점).

---

## 4. 자체 현장 테스트 (Field Observation)
> 테스터 음성 25문항(5개 유형 × 5문항), 실제 파이프라인(ffmpeg 노이즈 제거 → STT)으로 전사.
> ⚠️ 인간이 검증한 정답 전사(레퍼런스)를 별도로 확보하지 않았으므로 **정량 WER/CER이 아닌 정성 관찰**입니다.

**관찰 요약**
- 날짜·상황·추론·추억 등 **단문~중문 답변은 대부분 정확하게 전사**됨.
- 그림 설명하기의 **긴 문장(20~34자)도 자연스럽게 인식** (예: "버스 정류장에서 아이는 풍선을 놓쳤고 사람들은 버스를 타려고 준비함").
- 노이즈를 인위적으로 입힌 버전에서도 **대부분의 전사가 원본과 동일**하게 복원됨.

**관찰된 오인식 사례 (주로 짧은 단어의 모음/유사음 혼동)**
| 실제 발화(추정) | STT 결과 | 유형 |
|---|---|---|
| 불빛 | 볼 빛 | 모음 혼동 |
| 풍선 | 봉선 | 유사음 |
| 엎어지려던 | 아파트려던 | 유사음(노이즈 버전) |
| 귀신 | 의심 | 짧은 단어(노이즈 버전) |

- 경향: **짧은 단어·약한 발음·잡음 구간**에서 오인식이 집중됨(일반 ASR의 공통 한계). 문맥이 있는 긴 발화는 견고.

---

## 5. 한계 및 주의사항
- 위 현장 테스트는 **표본이 작고(25문항) 인간 검증 레퍼런스가 없어** 공식 수치로 인용 불가(정성 참고용).
- 공식 벤치마크(CER)는 **일반 한국어 코퍼스** 기준이며, **노인 발화/구음 장애/사투리** 등 우리 사용자 특성에 대한 별도 평가는 아님.
- 짧은 단어 오인식은 후단 LLM 적절성 채점에서 일부 보정될 수 있으나, STT 단계의 한계는 존재.

---

## 6. (권장) 정량 정확도 측정 방법
신뢰할 수 있는 WER/CER을 산출하려면 **인간이 전사한 정답 레퍼런스**가 필요합니다.

1. 테스터 음성 N개(권장 50개 이상)를 **사람이 직접 듣고 정답 전사** 작성.
2. 동일 음성을 파이프라인으로 STT.
3. `jiwer`로 CER/WER 계산:
   ```python
   import jiwer
   refs  = ["사람이 전사한 정답", ...]
   preds = ["STT 결과", ...]
   print("CER:", jiwer.cer(refs, preds))
   print("WER:", jiwer.wer(refs, preds))
   ```
4. 유형별/잡음 유무별로 나눠 집계 → 서비스 환경 실측 정확도 확보.

---

## 7. 결론
- 사용 모델 `seastar105/whisper-medium-komixv2`는 **한국어 대화체에 강한 파인튜닝 Whisper**로, 공식 CER 기준 **평균 7.3%**(large-v3보다 우수)로 신뢰할 만한 한국어 STT 성능을 보유.
- 현장 테스트에서도 **실사용 답변 대부분을 정확히 전사**, 일부 짧은 단어 오인식만 관찰.
- 서비스 대상(노인 자유 발화)에 대한 **자체 정량 평가(인간 라벨 기반 WER)** 를 추가하면 근거가 더 견고해짐.

---

## 8. 출처
- 모델 카드: https://huggingface.co/seastar105/whisper-medium-komixv2
- 베이스 모델: OpenAI Whisper (medium) — https://github.com/openai/whisper
- 벤치마크 테스트셋: KsponSpeech, Common Voice(ko), FLEURS(ko)
- 학습 데이터 출처: AIHub 한국어 음성 코퍼스
- 자체 현장 테스트: 프로젝트 내부 테스터 음성 25문항 (2026-06 수집)

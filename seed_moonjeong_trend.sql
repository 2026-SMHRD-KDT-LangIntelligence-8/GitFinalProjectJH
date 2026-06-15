-- 로컬 테스트 DB 전용: 수급자 '문정'(recipient_id=26)에게 2일 간격 × 30회 검사 더미 데이터 생성.
-- 점수는 시간에 따라 상승(30→88) + 유형별 오프셋 + 약간의 변동 → 기간별 추이/유형필터/피드백 검증용.
-- 각 검사는 5개 유형 각 1문항(총 5행)으로 구성.

SET @uid = '4925983394';
SET @rid = 26;

DROP PROCEDURE IF EXISTS seed_moonjeong_trend;
DELIMITER //
CREATE PROCEDURE seed_moonjeong_trend()
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE pid BIGINT;
    DECLARE qrid BIGINT;
    DECLARE pdate DATETIME;
    DECLARE base INT;
    DECLARE noise INT;

    WHILE i < 30 DO
        -- 가장 오래된 것이 i=0 (58일 전), 최신이 i=29 (오늘). 2일 간격.
        SET pdate = DATE_SUB(NOW(), INTERVAL (2 * (29 - i)) DAY);
        SET base = 30 + i * 2;                                   -- 30 → 88
        SET noise = CASE WHEN i % 3 = 0 THEN 5 WHEN i % 3 = 1 THEN -3 ELSE 0 END;

        INSERT INTO PERFORMANCE_RECORDS (user_id, recipient_id, performed_at)
        VALUES (@uid, @rid, pdate);
        SET pid = LAST_INSERT_ID();

        -- 유형1: 오늘 날짜 말하기 (+10)
        INSERT INTO QUESTION_RESULTS (performance_id, question_id, voice_file_path, stt_text)
        VALUES (pid, 251, '(test)', '테스트 더미 답변');
        SET qrid = LAST_INSERT_ID();
        INSERT INTO ANALYSIS_RESULTS (question_result_id, preprocessed_text, response_time, repetition_ratio, avg_sentence_length, appropriateness_score, analyzed_at)
        VALUES (qrid, '테스트 더미 답변', 2.00, 0.00, 12.00, LEAST(100, GREATEST(0, base + noise + 10)), pdate);

        -- 유형2: 그림 설명하기 (-8)
        INSERT INTO QUESTION_RESULTS (performance_id, question_id, voice_file_path, stt_text)
        VALUES (pid, 301, '(test)', '테스트 더미 답변');
        SET qrid = LAST_INSERT_ID();
        INSERT INTO ANALYSIS_RESULTS (question_result_id, preprocessed_text, response_time, repetition_ratio, avg_sentence_length, appropriateness_score, analyzed_at)
        VALUES (qrid, '테스트 더미 답변', 2.50, 0.00, 22.00, LEAST(100, GREATEST(0, base + noise - 8)), pdate);

        -- 유형3: 상황 질문 답하기 (+4)
        INSERT INTO QUESTION_RESULTS (performance_id, question_id, voice_file_path, stt_text)
        VALUES (pid, 351, '(test)', '테스트 더미 답변');
        SET qrid = LAST_INSERT_ID();
        INSERT INTO ANALYSIS_RESULTS (question_result_id, preprocessed_text, response_time, repetition_ratio, avg_sentence_length, appropriateness_score, analyzed_at)
        VALUES (qrid, '테스트 더미 답변', 2.00, 0.00, 10.00, LEAST(100, GREATEST(0, base + noise + 4)), pdate);

        -- 유형4: 규칙 기반 언어추론 (-4)
        INSERT INTO QUESTION_RESULTS (performance_id, question_id, voice_file_path, stt_text)
        VALUES (pid, 401, '(test)', '테스트 더미 답변');
        SET qrid = LAST_INSERT_ID();
        INSERT INTO ANALYSIS_RESULTS (question_result_id, preprocessed_text, response_time, repetition_ratio, avg_sentence_length, appropriateness_score, analyzed_at)
        VALUES (qrid, '테스트 더미 답변', 1.80, 0.00, 8.00, LEAST(100, GREATEST(0, base + noise - 4)), pdate);

        -- 유형5: 추억 말하기 (+0)
        INSERT INTO QUESTION_RESULTS (performance_id, question_id, voice_file_path, stt_text)
        VALUES (pid, 451, '(test)', '테스트 더미 답변');
        SET qrid = LAST_INSERT_ID();
        INSERT INTO ANALYSIS_RESULTS (question_result_id, preprocessed_text, response_time, repetition_ratio, avg_sentence_length, appropriateness_score, analyzed_at)
        VALUES (qrid, '테스트 더미 답변', 3.00, 0.00, 16.00, LEAST(100, GREATEST(0, base + noise)), pdate);

        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;

CALL seed_moonjeong_trend();
DROP PROCEDURE seed_moonjeong_trend;

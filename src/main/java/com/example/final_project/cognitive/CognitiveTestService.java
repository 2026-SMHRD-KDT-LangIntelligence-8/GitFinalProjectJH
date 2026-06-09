package com.example.final_project.cognitive;

import com.example.final_project.cognitive.dto.CognitiveQuestionResponse;
import com.example.final_project.cognitive.dto.CognitiveTestCompleteRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartRequest;
import com.example.final_project.cognitive.dto.CognitiveTestStartResponse;
import com.example.final_project.cognitive.dto.QuestionAudioUploadResponse;
import com.example.final_project.recipient.RecipientRepository;
import com.example.final_project.recipient.dto.RecipientResponse;
import com.example.final_project.user.CurrentUserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class CognitiveTestService {

    private static final String TEST_PURPOSE = "검사";
    private static final String TRAINING_PURPOSE = "훈련";
    private static final int QUESTION_TYPES_COUNT = 5;
    private static final int QUESTIONS_PER_TYPE = 5;
    private static final DateTimeFormatter FILE_TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("HHmmss");

    private final CognitiveTestRepository cognitiveTestRepository;
    private final RecipientRepository recipientRepository;
    private final CurrentUserService currentUserService;
    private final List<String> fallbackImagePaths;
    private final Path voiceRootDirectory;

    public CognitiveTestService(
            CognitiveTestRepository cognitiveTestRepository,
            RecipientRepository recipientRepository,
            CurrentUserService currentUserService,
            @Value("${app.cognitive.image-dir:./cognitive-images}") String imageDirectory,
            @Value("${app.cognitive.voice-dir:./cognitive-voice}") String voiceDirectory
    ) {
        this.cognitiveTestRepository = cognitiveTestRepository;
        this.recipientRepository = recipientRepository;
        this.currentUserService = currentUserService;
        this.fallbackImagePaths = loadFallbackImagePaths(imageDirectory);
        this.voiceRootDirectory = Paths.get(voiceDirectory);
    }

    public CognitiveTestStartResponse startTest(CognitiveTestStartRequest request) {
        return startSession(request, TEST_PURPOSE);
    }

    public CognitiveTestStartResponse startTraining(CognitiveTestStartRequest request) {
        return startSession(request, TRAINING_PURPOSE);
    }

    public void completeTest(CognitiveTestCompleteRequest request) {
        String userId = currentUserService.getRequiredUserId();
        recipientRepository.findByIdAndUserId(request.recipientId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + request.recipientId()));
    }

    public QuestionAudioUploadResponse saveQuestionAudio(Long performanceId, Long questionId, MultipartFile audioFile) {
        if (audioFile == null || audioFile.isEmpty()) {
            throw new IllegalArgumentException("저장할 음성 파일이 없습니다.");
        }

        String userId = currentUserService.getRequiredUserId();
        CognitiveTestRepository.QuestionAudioContext context =
                cognitiveTestRepository.findQuestionAudioContext(performanceId, questionId, userId);

        String savedRelativePath = storeAudioFile(context, audioFile);
        Long questionResultId = cognitiveTestRepository.createQuestionResult(performanceId, questionId, savedRelativePath);

        return new QuestionAudioUploadResponse(
                questionResultId,
                performanceId,
                questionId,
                savedRelativePath
        );
    }

    private CognitiveTestStartResponse startSession(CognitiveTestStartRequest request, String questionPurpose) {
        String userId = currentUserService.getRequiredUserId();
        RecipientResponse recipient = recipientRepository.findByIdAndUserId(request.recipientId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 수급자를 찾을 수 없습니다. id=" + request.recipientId()));

        Long performanceId = cognitiveTestRepository.createPerformanceRecord(recipient.getRecipientId(), userId);
        List<CognitiveQuestionResponse> questions = assignFallbackImages(
                cognitiveTestRepository.findRandomQuestionsPerType(QUESTIONS_PER_TYPE, questionPurpose)
        );

        int expectedQuestionCount = QUESTION_TYPES_COUNT * QUESTIONS_PER_TYPE;
        if (questions.size() != expectedQuestionCount) {
            throw new IllegalStateException(
                    questionPurpose + " 문항 수가 부족합니다. 예상=" + expectedQuestionCount + ", 실제=" + questions.size()
            );
        }

        return new CognitiveTestStartResponse(
                performanceId,
                recipient.getRecipientId(),
                recipient.getRecipientName(),
                QUESTIONS_PER_TYPE,
                expectedQuestionCount,
                70,
                questions
        );
    }

    private String storeAudioFile(CognitiveTestRepository.QuestionAudioContext context, MultipartFile audioFile) {
        try {
            LocalDate performedDate = context.performedAt().toLocalDate();
            Path dateDirectory = voiceRootDirectory.resolve(performedDate.toString());
            Path recipientDirectory = dateDirectory.resolve(buildRecipientDirectoryName(context.recipientName(), context.recipientId()));

            Files.createDirectories(recipientDirectory);

            String extension = resolveFileExtension(audioFile);
            String fileName = buildAudioFileName(context.questionTypeName(), context.questionId(), LocalDateTime.now(), extension);
            Path targetFile = recipientDirectory.resolve(fileName);

            try (InputStream inputStream = audioFile.getInputStream()) {
                Files.copy(inputStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
            }

            return voiceRootDirectory.relativize(targetFile).toString().replace("\\", "/");
        } catch (IOException exception) {
            throw new IllegalStateException("음성 파일 저장에 실패했습니다.", exception);
        }
    }

    private String buildRecipientDirectoryName(String recipientName, Long recipientId) {
        return sanitizePathSegment(recipientName) + "_" + recipientId;
    }

    private String buildAudioFileName(String questionTypeName, Long questionId, LocalDateTime now, String extension) {
        String safeQuestionTypeName = sanitizePathSegment(questionTypeName);
        String timestamp = now.format(FILE_TIMESTAMP_FORMATTER);
        return safeQuestionTypeName + "_q" + questionId + "_" + timestamp + "." + extension;
    }

    private String resolveFileExtension(MultipartFile audioFile) {
        String originalFilename = audioFile.getOriginalFilename();
        if (originalFilename != null) {
            int lastDotIndex = originalFilename.lastIndexOf('.');
            if (lastDotIndex >= 0 && lastDotIndex < originalFilename.length() - 1) {
                return sanitizeExtension(originalFilename.substring(lastDotIndex + 1));
            }
        }

        String contentType = audioFile.getContentType();
        if (contentType != null) {
            if (contentType.contains("webm")) {
                return "webm";
            }
            if (contentType.contains("ogg")) {
                return "ogg";
            }
            if (contentType.contains("mp4")) {
                return "mp4";
            }
            if (contentType.contains("mpeg")) {
                return "mp3";
            }
        }

        return "webm";
    }

    private String sanitizeExtension(String extension) {
        String sanitized = extension.toLowerCase().replaceAll("[^a-z0-9]", "");
        return sanitized.isBlank() ? "webm" : sanitized;
    }

    private String sanitizePathSegment(String value) {
        String sanitized = value == null ? "" : value.trim()
                .replaceAll("[\\\\/:*?\"<>|]", "_")
                .replaceAll("\\s+", "_");
        return sanitized.isBlank() ? "unknown" : sanitized;
    }

    private List<CognitiveQuestionResponse> assignFallbackImages(List<CognitiveQuestionResponse> questions) {
        if (fallbackImagePaths.isEmpty()) {
            return questions;
        }

        List<CognitiveQuestionResponse> results = new ArrayList<>(questions.size());

        for (CognitiveQuestionResponse question : questions) {
            if (question.imageFilePath() != null && !question.imageFilePath().isBlank()) {
                results.add(question);
                continue;
            }

            if (!isPictureDescriptionQuestion(question)) {
                results.add(question);
                continue;
            }

            String randomImagePath = fallbackImagePaths.get(
                    ThreadLocalRandom.current().nextInt(fallbackImagePaths.size())
            );

            results.add(new CognitiveQuestionResponse(
                    question.questionId(),
                    question.questionTypeId(),
                    question.questionTypeName(),
                    question.questionText(),
                    question.questionPurpose(),
                    randomImagePath,
                    question.imageDescriptionCriteria(),
                    question.questionSequence()
            ));
        }

        return results;
    }

    private boolean isPictureDescriptionQuestion(CognitiveQuestionResponse question) {
        String questionTypeName = question.questionTypeName();
        return questionTypeName != null && questionTypeName.contains("그림 설명하기");
    }

    private List<String> loadFallbackImagePaths(String imageDirectory) {
        Path imageDirectoryPath = Paths.get(imageDirectory);
        if (!Files.exists(imageDirectoryPath)) {
            return List.of();
        }

        try (Stream<Path> paths = Files.list(imageDirectoryPath)) {
            return paths
                    .filter(Files::isRegularFile)
                    .map(Path::getFileName)
                    .map(Path::toString)
                    .filter(name -> {
                        String lowerCaseName = name.toLowerCase();
                        return lowerCaseName.endsWith(".png")
                                || lowerCaseName.endsWith(".jpg")
                                || lowerCaseName.endsWith(".jpeg")
                                || lowerCaseName.endsWith(".webp");
                    })
                    .sorted()
                    .collect(Collectors.toList());
        } catch (IOException exception) {
            return List.of();
        }
    }
}

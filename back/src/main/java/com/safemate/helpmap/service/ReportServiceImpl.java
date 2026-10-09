package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.ReportCreateRequest;
import com.safemate.helpmap.dto.ReportResponse;
import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class ReportServiceImpl implements ReportService {

    private final ReportRepository reportRepository;
    private final CurrentMemberService currentMemberService;
    private final KakaoLocalService kakaoLocalService;

    @Value("${app.upload-dir}")
    private String uploadDir;

    @Override
    @Transactional
    public ReportResponse create(ReportCreateRequest request, MultipartFile image) {
        Member reporter = currentMemberService.resolve(request.deviceId());
        String imagePath = image == null || image.isEmpty() ? null : storeImage(image);
        String address = resolveAddress(request.latitude(), request.longitude());

        Report report = new Report(reporter, request.latitude(), request.longitude(), request.category(), imagePath, address);
        Report saved = reportRepository.save(report);

        // TODO(고도화 1단계): 여기서 SimpMessagingTemplate으로 /topic/reports 브로드캐스트
        // 경로 계산(RouteServiceImpl) 때마다 RiskWeightCalculator가 제보를 조회해 위험도에 반영하므로 별도 갱신 로직은 없다

        return ReportResponse.from(saved);
    }

    @Override
    public List<ReportResponse> findAll() {
        return reportRepository.findAll().stream()
                .map(ReportResponse::from)
                .toList();
    }

    @Override
    public List<ReportResponse> findMine(String deviceId) {
        String email = currentMemberService.currentEmail(deviceId);
        return reportRepository.findByReporter_EmailOrderByCreatedAtDesc(email).stream()
                .map(ReportResponse::from)
                .toList();
    }

    @Override
    @Transactional
    public void delete(Long reportId, String deviceId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 제보입니다."));

        if (!report.getReporter().getEmail().equals(currentMemberService.currentEmail(deviceId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인이 등록한 제보만 삭제할 수 있습니다.");
        }

        if (report.getImagePath() != null) {
            deleteImageFile(report.getImagePath());
        }
        reportRepository.delete(report);
    }

    // 주소 변환은 부가 정보라, 카카오 API 호출이 실패해도 제보 등록 자체는 막지 않고 주소만 비워둔다.
    private String resolveAddress(double latitude, double longitude) {
        try {
            return kakaoLocalService.coordToAddress(latitude, longitude);
        } catch (Exception e) {
            log.warn("좌표->주소 변환 실패: lat={}, lng={}", latitude, longitude, e);
            return null;
        }
    }

    private void deleteImageFile(String relativePath) {
        try {
            Files.deleteIfExists(Path.of(uploadDir, relativePath));
        } catch (IOException e) {
            log.warn("제보 사진 삭제 실패: {}", relativePath, e);
        }
    }

    // 허용 이미지 타입 -> 저장 확장자. 클라이언트가 보낸 원본 파일명은 신뢰하지 않고,
    // 서버가 검증한 Content-Type으로만 확장자를 정해서 위험한 확장자(.jsp 등) 업로드를 막는다.
    private static final Map<String, String> ALLOWED_IMAGE_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp"
    );

    private String storeImage(MultipartFile image) {
        String extension = ALLOWED_IMAGE_TYPES.get(image.getContentType());
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 파일(jpg, png, gif, webp)만 첨부할 수 있습니다.");
        }
        try {
            Path baseDir = Path.of(uploadDir, "reports");
            Files.createDirectories(baseDir);

            String filename = UUID.randomUUID() + extension;
            Path target = baseDir.resolve(filename);
            image.transferTo(target);

            return "reports/" + filename;
        } catch (IOException e) {
            throw new UncheckedIOException("제보 사진 저장 실패", e);
        }
    }
}

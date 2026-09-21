package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.ReportCreateRequest;
import com.safemate.helpmap.dto.ReportResponse;
import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.repository.MemberRepository;
import com.safemate.helpmap.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportServiceImpl implements ReportService {

    private final ReportRepository reportRepository;
    private final MemberRepository memberRepository;

    @Value("${app.upload-dir}")
    private String uploadDir;

    @Override
    @Transactional
    public ReportResponse create(ReportCreateRequest request, MultipartFile image) {
        Member reporter = findOrCreateAnonymousMember(request.deviceId());
        String imagePath = image == null || image.isEmpty() ? null : storeImage(image);

        Report report = new Report(reporter, request.latitude(), request.longitude(), request.category(), imagePath);
        Report saved = reportRepository.save(report);

        // TODO(고도화 1단계): 여기서 SimpMessagingTemplate으로 /topic/reports 브로드캐스트
        // TODO(2단계): 저장된 좌표 주변 Edge의 riskWeight 갱신 로직 연결

        return ReportResponse.from(saved);
    }

    @Override
    public List<ReportResponse> findAll() {
        return reportRepository.findAll().stream()
                .map(ReportResponse::from)
                .toList();
    }

    /**
     * 로그인 없는 MVP용 임시 처리: 브라우저가 발급한 deviceId를 Member.email 자리에 그대로 써서
     * 재방문 시 같은 회원으로 인식한다. 정식 로그인이 붙으면 이 메서드만 교체하면 됨.
     */
    private Member findOrCreateAnonymousMember(String deviceId) {
        String anonymousEmail = "anon:" + deviceId;
        return memberRepository.findByEmail(anonymousEmail)
                .orElseGet(() -> memberRepository.save(new Member(anonymousEmail, "", "익명 사용자")));
    }

    private String storeImage(MultipartFile image) {
        try {
            Path baseDir = Path.of(uploadDir, "reports");
            Files.createDirectories(baseDir);

            String extension = getExtension(image.getOriginalFilename());
            String filename = UUID.randomUUID() + extension;
            Path target = baseDir.resolve(filename);
            image.transferTo(target);

            return "reports/" + filename;
        } catch (IOException e) {
            throw new UncheckedIOException("제보 사진 저장 실패", e);
        }
    }

    private String getExtension(String originalFilename) {
        if (originalFilename == null || !originalFilename.contains(".")) return "";
        return originalFilename.substring(originalFilename.lastIndexOf('.'));
    }
}

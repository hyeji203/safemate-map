package com.safemate.helpmap.service;

import com.safemate.helpmap.dto.ReportCreateRequest;
import com.safemate.helpmap.dto.ReportResponse;
import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.repository.MemberRepository;
import com.safemate.helpmap.repository.ReportRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportServiceImpl implements ReportService {

    private final ReportRepository reportRepository;
    private final MemberRepository memberRepository;

    @Override
    @Transactional
    public ReportResponse create(ReportCreateRequest request) {
        Member reporter = memberRepository.findById(request.reporterId())
                .orElseThrow(() -> new EntityNotFoundException("존재하지 않는 회원입니다. id=" + request.reporterId()));

        Report report = new Report(reporter, request.latitude(), request.longitude(), request.category());
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
}

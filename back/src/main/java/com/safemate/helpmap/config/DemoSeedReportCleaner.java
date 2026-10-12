package com.safemate.helpmap.config;

import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.repository.ReportRepository;
import com.safemate.helpmap.service.AnonymousMemberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 예전 ReportSeedLoader가 "demo-seed" 계정으로 자동 등록하던 발표용 더미 제보를 서버 시작 시 지운다.
 * 더미 제보 자동 생성은 팀 결정으로 없앴고(위치가 애매함), 이미 각자 DB에 들어간 것을 정리하려고 남겨 둔다.
 * 실제 사용자 제보는 건드리지 않는다. 더미 제보가 없으면 아무것도 하지 않는다.
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
public class DemoSeedReportCleaner implements CommandLineRunner {

    // 예전 ReportSeedLoader가 쓰던 고정 deviceId
    private static final String SEED_DEVICE_ID = "demo-seed";

    private final ReportRepository reportRepository;

    @Override
    @Transactional
    public void run(String... args) {
        List<Report> seeds = reportRepository.findByReporter_EmailOrderByCreatedAtDesc(
                AnonymousMemberService.emailOf(SEED_DEVICE_ID));
        if (seeds.isEmpty()) {
            return;
        }
        reportRepository.deleteAll(seeds);
        log.info("예전 발표용 더미 제보 삭제: {}개", seeds.size());
    }
}

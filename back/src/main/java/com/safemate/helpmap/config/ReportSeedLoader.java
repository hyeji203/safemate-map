package com.safemate.helpmap.config;

import com.safemate.helpmap.entity.Member;
import com.safemate.helpmap.entity.Report;
import com.safemate.helpmap.entity.type.ReportCategory;
import com.safemate.helpmap.repository.ReportRepository;
import com.safemate.helpmap.service.AnonymousMemberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 발표/시연 때 빈 지도로 보이지 않도록 신구대학교 인근(시연 지역)에 더미 제보를 미리 깔아 둔다.
 * reports 테이블이 비어 있을 때만 동작한다. 실제 시민 제보가 하나라도 쌓이면 더 이상 추가하지 않는다.
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
public class ReportSeedLoader implements CommandLineRunner {

    // "anon:demo-seed" 계정으로 등록되며, 실제 사용자 제보와 구분하기 쉽도록 고정 deviceId를 쓴다.
    private static final String SEED_DEVICE_ID = "demo-seed";

    private record Seed(double latitude, double longitude, ReportCategory category) {
    }

    private static final List<Seed> SEEDS = List.of(
            new Seed(37.44905, 127.16740, ReportCategory.STREETLIGHT_BROKEN),
            new Seed(37.44860, 127.16620, ReportCategory.DARK_ALLEY),
            new Seed(37.45010, 127.16810, ReportCategory.EMPTY_STREET),
            new Seed(37.44780, 127.16700, ReportCategory.SIDEWALK_DAMAGED),
            new Seed(37.44950, 127.16550, ReportCategory.DARK_ALLEY),
            new Seed(37.44830, 127.16880, ReportCategory.STREETLIGHT_BROKEN)
    );

    private final ReportRepository reportRepository;
    private final AnonymousMemberService anonymousMemberService;

    @Override
    public void run(String... args) {
        if (reportRepository.count() > 0) {
            return;
        }

        Member seedMember = anonymousMemberService.findOrCreate(SEED_DEVICE_ID);
        SEEDS.forEach(seed -> reportRepository.save(
                new Report(seedMember, seed.latitude(), seed.longitude(), seed.category(), null)));

        log.info("발표용 더미 제보 적재: {}개", SEEDS.size());
    }
}

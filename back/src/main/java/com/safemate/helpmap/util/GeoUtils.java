package com.safemate.helpmap.util;

public final class GeoUtils {

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    private GeoUtils() {
    }

    /** 하버사인 공식으로 두 좌표 사이의 거리(m)를 계산한다. */
    public static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
    }

    /**
     * 점 P에서 선분 AB까지의 최단 거리(m). 수백 m 규모에서는 평면 근사로 충분해서
     * A를 원점으로 하는 등장방형(equirectangular) 좌표로 변환해 계산한다.
     */
    public static double distanceToSegmentMeters(double pLat, double pLng,
                                                 double aLat, double aLng,
                                                 double bLat, double bLng) {
        double metersPerDegLat = Math.toRadians(1) * EARTH_RADIUS_METERS;
        double metersPerDegLng = metersPerDegLat * Math.cos(Math.toRadians(aLat));

        double px = (pLng - aLng) * metersPerDegLng;
        double py = (pLat - aLat) * metersPerDegLat;
        double bx = (bLng - aLng) * metersPerDegLng;
        double by = (bLat - aLat) * metersPerDegLat;

        double lengthSquared = bx * bx + by * by;
        double t = lengthSquared == 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
        return Math.hypot(px - t * bx, py - t * by);
    }
}
